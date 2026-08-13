import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, ImagePlus, Loader2, Star, Trash2, Upload } from 'lucide-react'
import { Badge } from '@/componentes/ui/badge'
import { notificar } from '@/lib/notificacoes'
import {
  comprimirImagem,
  ehImagemAceita,
  TAMANHO_MAXIMO_ENTRADA,
} from '@/lib/imagens'
import { formatarTamanhoArquivo } from '@/lib/formato'
import { cn } from '@/lib/utils'

/** Limite imposto também por trigger no banco. Ver BANCO.md, trigger 6. */
export const MAXIMO_FOTOS = 10

export interface FotoEmEdicao {
  /** Chave estável para o React e para o arrastar. */
  chave: string
  /** Id em `imoveis_fotos`. Ausente enquanto a foto não foi salva. */
  id?: string
  /** URL pública (foto já salva) ou blob local (foto nova). */
  previa: string
  /** Arquivo a enviar. Ausente nas fotos já salvas. */
  arquivo?: File
  capa: boolean
  tamanhoOriginal?: number
  tamanhoFinal?: number
}

interface Props {
  fotos: FotoEmEdicao[]
  aoMudar: (fotos: FotoEmEdicao[]) => void
}

export function GerenciadorFotos({ fotos, aoMudar }: Props) {
  const entradaRef = useRef<HTMLInputElement>(null)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [indiceArrastado, setIndiceArrastado] = useState<number | null>(null)
  const [indiceAlvo, setIndiceAlvo] = useState<number | null>(null)

  const restantes = MAXIMO_FOTOS - fotos.length

  // Libera as URLs de blob ao desmontar, senão o navegador segura os
  // arquivos em memória até o reload.
  useEffect(() => {
    return () => {
      for (const foto of fotos) {
        if (foto.arquivo) URL.revokeObjectURL(foto.previa)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const adicionar = useCallback(
    async (lista: FileList | File[]) => {
      const arquivos = Array.from(lista)
      if (arquivos.length === 0) return

      const validos: File[] = []
      let recusadosPorTipo = 0
      let recusadosPorTamanho = 0

      for (const arquivo of arquivos) {
        if (!ehImagemAceita(arquivo)) {
          recusadosPorTipo++
          continue
        }
        if (arquivo.size > TAMANHO_MAXIMO_ENTRADA) {
          recusadosPorTamanho++
          continue
        }
        validos.push(arquivo)
      }

      if (recusadosPorTipo > 0) {
        notificar.aviso(
          `${recusadosPorTipo} ${recusadosPorTipo === 1 ? 'arquivo ignorado' : 'arquivos ignorados'}`,
          'Apenas PNG, JPEG e WEBP são aceitos.',
        )
      }
      if (recusadosPorTamanho > 0) {
        notificar.aviso(
          `${recusadosPorTamanho} ${recusadosPorTamanho === 1 ? 'arquivo ignorado' : 'arquivos ignorados'}`,
          `Cada foto pode ter no máximo ${formatarTamanhoArquivo(TAMANHO_MAXIMO_ENTRADA)}.`,
        )
      }

      // Bloqueia acima do limite ANTES de comprimir e enviar. O trigger
      // do banco também barra, mas descobrir o limite só depois de
      // processar 15 fotos de celular é tempo perdido do usuário.
      if (validos.length > restantes) {
        notificar.aviso(
          'Limite de 10 fotos por imóvel',
          restantes === 0
            ? 'Este imóvel já tem 10 fotos. Remova alguma para adicionar outra.'
            : `Cabem mais ${restantes}. ${validos.length - restantes} ${
                validos.length - restantes === 1 ? 'foto foi ignorada' : 'fotos foram ignoradas'
              }.`,
        )
      }

      const aceitos = validos.slice(0, Math.max(0, restantes))
      if (aceitos.length === 0) return

      setProcessando(true)
      try {
        const comprimidas = await Promise.all(aceitos.map(comprimirImagem))
        const novas: FotoEmEdicao[] = comprimidas.map((imagem, indice) => ({
          chave: crypto.randomUUID(),
          previa: imagem.previa,
          arquivo: imagem.arquivo,
          // Primeira foto do imóvel já nasce como capa.
          capa: fotos.length === 0 && indice === 0,
          tamanhoOriginal: imagem.tamanhoOriginal,
          tamanhoFinal: imagem.tamanhoFinal,
        }))

        const economia =
          comprimidas.reduce((total, i) => total + (i.tamanhoOriginal - i.tamanhoFinal), 0)
        if (economia > 512 * 1024) {
          notificar.informacao(
            `${novas.length === 1 ? 'Foto adicionada' : `${novas.length} fotos adicionadas`}`,
            `${formatarTamanhoArquivo(economia)} economizados na compressão.`,
          )
        }

        aoMudar([...fotos, ...novas])
      } finally {
        setProcessando(false)
      }
    },
    [fotos, restantes, aoMudar],
  )

  function remover(chave: string) {
    const alvo = fotos.find((f) => f.chave === chave)
    if (alvo?.arquivo) URL.revokeObjectURL(alvo.previa)

    const restando = fotos.filter((f) => f.chave !== chave)
    // Se a capa saiu, a primeira da ordem assume — o imóvel nunca fica
    // sem capa enquanto tiver foto.
    if (alvo?.capa && restando.length > 0) restando[0] = { ...restando[0], capa: true }
    aoMudar(restando)
  }

  function definirCapa(chave: string) {
    aoMudar(fotos.map((f) => ({ ...f, capa: f.chave === chave })))
  }

  function reordenar(de: number, para: number) {
    if (de === para) return
    const copia = [...fotos]
    const [movida] = copia.splice(de, 1)
    copia.splice(para, 0, movida)
    aoMudar(copia)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Área de soltura ---------- */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (indiceArrastado === null) setArrastandoArquivo(true)
        }}
        onDragLeave={() => setArrastandoArquivo(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastandoArquivo(false)
          if (indiceArrastado === null && e.dataTransfer.files.length > 0) {
            void adicionar(e.dataTransfer.files)
          }
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors',
          arrastandoArquivo
            ? 'border-destaque bg-destaque-suave'
            : 'border-borda-forte bg-superficie-alternativa',
          restantes === 0 && 'opacity-60',
        )}
      >
        {processando ? (
          <>
            <Loader2 className="size-7 animate-spin text-destaque" />
            <p className="text-sm font-medium text-texto">Comprimindo as fotos…</p>
          </>
        ) : (
          <>
            <Upload className="size-7 text-texto-tenue" strokeWidth={1.7} />
            <p className="text-sm font-medium text-texto">
              Arraste as fotos aqui ou{' '}
              <button
                type="button"
                onClick={() => entradaRef.current?.click()}
                disabled={restantes === 0}
                className="cursor-pointer text-destaque underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:no-underline"
              >
                escolha do computador
              </button>
            </p>
            <p className="text-xs text-texto-tenue">
              PNG, JPEG ou WEBP · redimensionadas e convertidas para WEBP antes do envio
            </p>
          </>
        )}

        <input
          ref={entradaRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void adicionar(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* ---------- Contador ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">
          <span
            className={cn(
              'font-semibold',
              fotos.length >= MAXIMO_FOTOS ? 'text-alerta' : 'text-texto',
            )}
          >
            {fotos.length}
          </span>{' '}
          de {MAXIMO_FOTOS} fotos
          {restantes > 0 && (
            <span className="text-texto-tenue"> · cabem mais {restantes}</span>
          )}
        </p>
        {fotos.length > 1 && (
          <p className="text-xs text-texto-tenue">
            Arraste as fotos para reordenar · clique na estrela para definir a capa
          </p>
        )}
      </div>

      {/* ---------- Galeria ---------- */}
      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {fotos.map((foto, indice) => (
            <li
              key={foto.chave}
              draggable
              onDragStart={() => setIndiceArrastado(indice)}
              onDragEnter={() => indiceArrastado !== null && setIndiceAlvo(indice)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                if (indiceArrastado !== null && indiceAlvo !== null) {
                  reordenar(indiceArrastado, indiceAlvo)
                }
                setIndiceArrastado(null)
                setIndiceAlvo(null)
              }}
              className={cn(
                'group relative aspect-4/3 cursor-grab overflow-hidden rounded-lg border bg-superficie-alternativa transition-all active:cursor-grabbing',
                foto.capa ? 'border-destaque ring-2 ring-destaque/25' : 'border-borda',
                indiceArrastado === indice && 'opacity-40',
                indiceAlvo === indice && indiceArrastado !== indice && 'ring-2 ring-destaque',
              )}
            >
              <img src={foto.previa} alt="" className="size-full object-cover" />

              {foto.capa && (
                <Badge variante="destaque" className="absolute left-2 top-2">
                  <Star className="size-3 fill-current" />
                  Capa
                </Badge>
              )}

              <span className="absolute right-2 top-2 rounded-md bg-texto/70 p-1 text-superficie opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <GripVertical className="size-3.5" />
              </span>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-linear-to-t from-texto/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => definirCapa(foto.chave)}
                  disabled={foto.capa}
                  title="Definir como capa"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-superficie/90 text-texto-suave transition-colors hover:text-destaque disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Star className={cn('size-4', foto.capa && 'fill-current text-destaque')} />
                  <span className="sr-only">Definir como capa</span>
                </button>

                <button
                  type="button"
                  onClick={() => remover(foto.chave)}
                  title="Remover foto"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-superficie/90 text-texto-suave transition-colors hover:text-destrutivo"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remover foto</span>
                </button>
              </div>
            </li>
          ))}

          {restantes > 0 && (
            <li>
              <button
                type="button"
                onClick={() => entradaRef.current?.click()}
                className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-borda-forte text-texto-tenue transition-colors hover:border-destaque hover:text-destaque"
              >
                <ImagePlus className="size-6" strokeWidth={1.7} />
                <span className="text-xs font-medium">Adicionar</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
