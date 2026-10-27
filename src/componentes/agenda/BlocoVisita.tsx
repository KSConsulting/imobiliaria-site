import { Ban, Check } from 'lucide-react'
import { comOpacidade, corDoTextoSobre } from '@/lib/coresCorretores'
import { formatarHora } from '@/lib/datas'
import type { VisitaCompleta } from '@/lib/agendamentos'
import { cn } from '@/lib/utils'

interface Props {
  visita: VisitaCompleta
  fuso: string
  /** Posicionamento absoluto dentro da coluna do dia. */
  estilo?: React.CSSProperties
  /** Destaque de entrada quando a visita chegou pelo agente de IA. */
  recemChegada?: boolean
  arrastavel?: boolean
  aoAbrir: (visita: VisitaCompleta) => void
  aoIniciarArrasto?: (visita: VisitaCompleta) => void
  aoTerminarArrasto?: () => void
}

export function BlocoVisita({
  visita,
  fuso,
  estilo,
  recemChegada,
  arrastavel = true,
  aoAbrir,
  aoIniciarArrasto,
  aoTerminarArrasto,
}: Props) {
  const cor = visita.corretores?.cor ?? '#57534E'
  const cancelada = visita.status === 'cancelada'
  const realizada = visita.status === 'realizada'
  const reagendada = visita.status === 'reagendada'
  const inativa = cancelada || reagendada

  const nomeLead = visita.crm_imobiliaria?.nome ?? visita.crm_imobiliaria?.whatsapp ?? 'Lead'
  const corretor = visita.corretores
    ? `${visita.corretores.nome} ${visita.corretores.sobrenome}`
    : 'Sem corretor'

  const titulo = [
    `${formatarHora(new Date(visita.data_hora_inicio), fuso)} às ${formatarHora(new Date(visita.data_hora_fim), fuso)}`,
    nomeLead,
    visita.codigo_imovel ? `${visita.codigo_imovel} · ${visita.imoveis?.titulo ?? 'imóvel excluído'}` : 'Sem imóvel definido',
    corretor,
    visita.status !== 'agendada' ? `Status: ${visita.status}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <button
      type="button"
      title={titulo}
      draggable={arrastavel && !inativa}
      onDragStart={() => aoIniciarArrasto?.(visita)}
      onDragEnd={() => aoTerminarArrasto?.()}
      onClick={(e) => {
        e.stopPropagation()
        aoAbrir(visita)
      }}
      style={{
        ...estilo,
        backgroundColor: inativa ? comOpacidade(cor, 0.16) : cor,
        color: inativa ? undefined : corDoTextoSobre(cor),
        borderLeftColor: cor,
      }}
      className={cn(
        'group absolute overflow-hidden rounded-md border-l-3 px-1.5 py-1 text-left text-[0.6875rem] leading-tight transition-shadow',
        'hover:z-20 hover:shadow-elevado focus-visible:z-20',
        arrastavel && !inativa ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        inativa && 'text-texto-suave',
        recemChegada && 'animate-in fade-in zoom-in-95 duration-500 ring-2 ring-destaque ring-offset-1',
      )}
    >
      <span className="flex items-center gap-1 font-semibold">
        {cancelada && <Ban className="size-3 shrink-0" />}
        {realizada && <Check className="size-3 shrink-0" />}
        <span className={cn('truncate', cancelada && 'line-through')}>
          {formatarHora(new Date(visita.data_hora_inicio), fuso)}
        </span>
      </span>

      <span className={cn('block truncate font-medium', cancelada && 'line-through')}>
        {nomeLead}
      </span>

      {visita.codigo_imovel && (
        <span className="block truncate opacity-80">{visita.codigo_imovel}</span>
      )}

      {/* Hachura discreta nas canceladas: some do olhar sem sumir da tela. */}
      {inativa && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${comOpacidade(cor, 0.35)} 4px, ${comOpacidade(cor, 0.35)} 8px)`,
          }}
        />
      )}
    </button>
  )
}
