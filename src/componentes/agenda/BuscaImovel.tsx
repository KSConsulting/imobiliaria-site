import { useEffect, useState } from 'react'
import { Building2, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/componentes/ui/input'
import { buscarImoveisParaVisita, type ImovelResumo } from '@/lib/agendamentos'

interface Props {
  selecionado: ImovelResumo | null
  aoSelecionar: (imovel: ImovelResumo | null) => void
}

/**
 * Busca de imóvel — opcional na visita.
 *
 * Opcional de propósito: acontece de marcar a visita antes de decidir o
 * que será mostrado, especialmente quando o cliente ainda está
 * escolhendo entre três opções.
 */
export function BuscaImovel({ selecionado, aoSelecionar }: Props) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ImovelResumo[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (selecionado) return

    let ativo = true
    setBuscando(true)
    const tempo = setTimeout(async () => {
      try {
        const lista = await buscarImoveisParaVisita(termo)
        if (ativo) setResultados(lista)
      } catch {
        if (ativo) setResultados([])
      } finally {
        if (ativo) setBuscando(false)
      }
    }, 250)

    return () => {
      ativo = false
      clearTimeout(tempo)
    }
  }, [termo, selecionado])

  if (selecionado) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destaque bg-destaque-suave px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Building2 className="size-4 shrink-0 text-destaque" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-texto">
              <span className="font-mono text-xs text-texto-suave">{selecionado.codigo}</span>{' '}
              {selecionado.titulo}
            </p>
            <p className="truncate text-xs text-texto-suave">
              {selecionado.bairro}, {selecionado.cidade}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => aoSelecionar(null)}
          aria-label="Remover imóvel"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-texto-suave transition-colors hover:bg-superficie hover:text-texto"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por código, título ou bairro"
          className="pl-10"
        />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-texto-tenue" />
        )}
      </div>

      <div className="max-h-40 overflow-y-auto rounded-lg border border-borda">
        {resultados.length === 0 ? (
          <p className="px-3.5 py-4 text-center text-sm text-texto-tenue">
            {termo ? 'Nenhum imóvel encontrado.' : 'Nenhum imóvel cadastrado ainda.'}
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {resultados.map((imovel) => (
              <li key={imovel.id}>
                <button
                  type="button"
                  onClick={() => aoSelecionar(imovel)}
                  className="flex w-full cursor-pointer flex-col gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-superficie-alternativa"
                >
                  <span className="truncate text-sm font-medium text-texto">
                    <span className="font-mono text-xs text-texto-suave">{imovel.codigo}</span>{' '}
                    {imovel.titulo}
                  </span>
                  <span className="truncate text-xs text-texto-suave">
                    {imovel.bairro}, {imovel.cidade}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
