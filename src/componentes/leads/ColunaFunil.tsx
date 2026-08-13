import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/componentes/ui/skeleton'
import { CartaoLead } from '@/componentes/leads/CartaoLead'
import type { EtapaFunil, LeadComImovel } from '@/lib/leads'
import { cn } from '@/lib/utils'

export interface EstadoColuna {
  leads: LeadComImovel[]
  /** Contagem real da etapa inteira, não do que está carregado. */
  total: number
  carregando: boolean
  carregandoMais: boolean
}

export const COLUNA_VAZIA: EstadoColuna = {
  leads: [],
  total: 0,
  carregando: true,
  carregandoMais: false,
}

interface Props {
  etapa: EtapaFunil
  estado: EstadoColuna
  fuso: string
  destacados: Set<string>
  idArrastado: string | null
  aoAbrir: (lead: LeadComImovel) => void
  aoIniciarArrasto: (lead: LeadComImovel) => void
  aoTerminarArrasto: () => void
  aoSoltar: (etapa: EtapaFunil) => void
  aoCarregarMais: (etapa: EtapaFunil) => void
}

/** Distância do fim da rolagem que dispara o carregamento da próxima página. */
const MARGEM_ROLAGEM = 120

/**
 * Uma coluna do Kanban, com rolagem e paginação próprias.
 *
 * O Kanban inteiro carregado de uma vez degrada conforme a base cresce —
 * e cresce sempre, porque o agente de IA nunca para de criar lead. Cada
 * coluna traz um punhado de cards e busca mais conforme o usuário rola
 * aquela coluna especificamente.
 *
 * O cabeçalho mostra a contagem real da etapa, e não quantos cards estão
 * na tela: a pergunta que o Kanban responde de relance é "quantos estão
 * parados aqui", e uma contagem que cresce à medida que se rola seria
 * pior do que nenhuma.
 */
export function ColunaFunil({
  etapa,
  estado,
  fuso,
  destacados,
  idArrastado,
  aoAbrir,
  aoIniciarArrasto,
  aoTerminarArrasto,
  aoSoltar,
  aoCarregarMais,
}: Props) {
  const [sobre, setSobre] = useState(false)
  const corpo = useRef<HTMLDivElement>(null)

  const restam = estado.total - estado.leads.length
  const temMais = restam > 0

  function aoRolar() {
    const elemento = corpo.current
    if (!elemento || !temMais || estado.carregandoMais || estado.carregando) return

    const fim = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight
    if (fim < MARGEM_ROLAGEM) aoCarregarMais(etapa)
  }

  return (
    <section
      onDragOver={(e) => {
        // Sem o preventDefault o navegador recusa o drop e o card volta.
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!sobre) setSobre(true)
      }}
      onDragLeave={(e) => {
        // O dragleave dispara ao passar sobre os filhos; só conta quando
        // o ponteiro sai de fato da coluna.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setSobre(false)
        aoSoltar(etapa)
      }}
      aria-label={`${etapa.rotulo}: ${estado.total} ${estado.total === 1 ? 'lead' : 'leads'}`}
      className={cn(
        'flex w-[86vw] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-superficie-alternativa transition-colors sm:w-[17.5rem]',
        sobre ? 'border-destaque bg-destaque-suave' : 'border-borda',
      )}
    >
      {/* Cabeçalho */}
      <header className="shrink-0">
        <div className={cn('h-1', etapa.barra)} aria-hidden />
        <div className="flex items-center justify-between gap-2 px-3.5 py-3">
          <h3 className="truncate text-sm font-semibold text-texto">{etapa.rotulo}</h3>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              etapa.badge,
            )}
          >
            {estado.carregando ? '—' : estado.total}
          </span>
        </div>
      </header>

      {/* Cards */}
      <div
        ref={corpo}
        onScroll={aoRolar}
        className="flex max-h-[calc(100dvh-24rem)] min-h-56 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3"
      >
        {estado.carregando ? (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        ) : estado.leads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-borda-forte px-3 py-6 text-center text-xs leading-relaxed text-texto-tenue">
            {etapa.vazio}
            <span className="mt-1 block">Arraste um card para cá.</span>
          </p>
        ) : (
          <>
            {estado.leads.map((lead) => (
              <CartaoLead
                key={lead.id}
                lead={lead}
                fuso={fuso}
                destacado={destacados.has(lead.id)}
                arrastando={idArrastado === lead.id}
                aoAbrir={aoAbrir}
                aoIniciarArrasto={aoIniciarArrasto}
                aoTerminarArrasto={aoTerminarArrasto}
              />
            ))}

            {temMais && (
              <button
                type="button"
                onClick={() => aoCarregarMais(etapa)}
                disabled={estado.carregandoMais}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-borda bg-superficie px-3 py-2.5 text-xs font-medium text-texto-suave transition-colors hover:text-texto disabled:cursor-default"
              >
                {estado.carregandoMais && <Loader2 className="size-3.5 animate-spin" />}
                {estado.carregandoMais ? 'Carregando…' : `Carregar mais ${restam}`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
