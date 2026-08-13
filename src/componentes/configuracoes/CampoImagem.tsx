import { useRef, useState } from 'react'
import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { notificar } from '@/lib/notificacoes'
import { formatarTamanhoArquivo } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  rotulo: string
  /** URL já salva, ou a prévia local do arquivo recém-escolhido. */
  valor: string | null
  /** Tipos MIME aceitos. Precisa bater com os do bucket. */
  tiposAceitos: string[]
  /** Recomendação de formato e proporção, exibida ao lado. */
  recomendacao: string
  /** O que acontece quando o campo fica vazio. */
  semImagem: string
  /** Fundo do preview: logo aparece sobre claro, foto ocupa o quadro todo. */
  ajuste: 'contido' | 'preenchido'
  /**
   * Teto do arquivo **de entrada**, em bytes.
   *
   * Só faz sentido onde o arquivo sobe como veio. No hero ele é
   * comprimido antes de subir, então recusar a foto de 9 MB do celular
   * seria barrar exatamente o caso que a compressão existe para
   * resolver.
   */
  tamanhoMaximo?: number
  aoEscolher: (arquivo: File) => Promise<void>
  aoRemover: () => void
  desabilitado?: boolean
}

/**
 * Campo de imagem com prévia imediata.
 *
 * A prévia aparece antes do upload terminar — o arquivo local já é
 * exibido enquanto sobe. Esperar o Storage responder para só então
 * mostrar algo faz o campo parecer travado justamente no momento em que
 * o usuário quer confirmar que escolheu o arquivo certo.
 */
export function CampoImagem({
  rotulo,
  valor,
  tiposAceitos,
  recomendacao,
  semImagem,
  ajuste,
  tamanhoMaximo,
  aoEscolher,
  aoRemover,
  desabilitado,
}: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [previaLocal, setPreviaLocal] = useState<string | null>(null)

  const exibida = previaLocal ?? valor

  async function selecionar(arquivo: File | undefined) {
    if (!arquivo) return

    if (!tiposAceitos.includes(arquivo.type.toLowerCase())) {
      notificar.erro(
        'Formato não aceito',
        `Envie ${tiposAceitos.map(extensaoLegivel).join(', ')}.`,
      )
      return
    }

    if (tamanhoMaximo && arquivo.size > tamanhoMaximo) {
      notificar.erro(
        'Arquivo muito grande',
        `O limite é ${formatarTamanhoArquivo(tamanhoMaximo)} e este tem ${formatarTamanhoArquivo(arquivo.size)}.`,
      )
      return
    }

    const previa = URL.createObjectURL(arquivo)
    setPreviaLocal(previa)
    setEnviando(true)

    try {
      await aoEscolher(arquivo)
    } finally {
      setEnviando(false)
      // A prévia local sai de cena assim que o upload termina: a partir
      // daí a fonte da verdade é a URL do Storage, e manter as duas
      // faria a imagem "piscar" de volta para a antiga num recarregamento.
      URL.revokeObjectURL(previa)
      setPreviaLocal(null)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div
        className={cn(
          'relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-borda',
          ajuste === 'contido' ? 'bg-superficie-alternativa p-2' : 'bg-superficie-alternativa',
        )}
      >
        {exibida ? (
          <img
            src={exibida}
            alt={rotulo}
            className={cn('size-full', ajuste === 'contido' ? 'object-contain' : 'object-cover')}
          />
        ) : (
          <ImageUp className="size-7 text-texto-tenue" strokeWidth={1.6} />
        )}

        {enviando && (
          <div className="absolute inset-0 flex items-center justify-center bg-superficie/75">
            <Loader2 className="size-5 animate-spin text-destaque" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-texto">{rotulo}</p>
        <p className="text-xs leading-relaxed text-texto-tenue">{recomendacao}</p>
        {!exibida && <p className="text-xs leading-relaxed text-texto-suave">{semImagem}</p>}

        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={desabilitado || enviando}
            onClick={() => entrada.current?.click()}
          >
            <ImageUp className="size-4" />
            {exibida ? 'Trocar' : 'Enviar'}
          </Button>

          {exibida && (
            <Button
              type="button"
              variante="fantasma"
              tamanho="pequeno"
              disabled={desabilitado || enviando}
              onClick={aoRemover}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          )}
        </div>

        <input
          ref={entrada}
          type="file"
          accept={tiposAceitos.join(',')}
          className="hidden"
          onChange={(evento) => void selecionar(evento.target.files?.[0])}
        />
      </div>
    </div>
  )
}

function extensaoLegivel(mime: string): string {
  return mime.replace('image/', '').replace('svg+xml', 'SVG').toUpperCase()
}
