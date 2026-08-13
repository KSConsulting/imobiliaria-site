import { Building2, CalendarCheck, Clock } from 'lucide-react'
import { Badge } from '@/componentes/ui/badge'
import {
  nomeExibido,
  resumirInteresse,
  type LeadComImovel,
} from '@/lib/leads'
import { formatarData, tempoRelativo } from '@/lib/datas'
import { formatarMoedaCurta } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  lead: LeadComImovel
  fuso: string
  /** Acabou de se mover sozinho, por Realtime. Recebe o pulso de destaque. */
  destacado: boolean
  arrastando: boolean
  aoAbrir: (lead: LeadComImovel) => void
  aoIniciarArrasto: (lead: LeadComImovel) => void
  aoTerminarArrasto: () => void
}

/**
 * Card do Kanban.
 *
 * Compacto porque a coluna é estreita e o valor da tela está em ver
 * muitos de uma vez. Cada linha existe por um motivo de decisão: quem é,
 * o que quer, há quanto tempo sumiu e se já tem visita marcada — que é
 * exatamente o que separa o lead que precisa de ação do que não precisa.
 */
export function CartaoLead({
  lead,
  fuso,
  destacado,
  arrastando,
  aoAbrir,
  aoIniciarArrasto,
  aoTerminarArrasto,
}: Props) {
  const interesse = resumirInteresse(lead, formatarMoedaCurta)

  return (
    <article
      draggable
      onDragStart={(e) => {
        // O texto precisa existir para o Firefox iniciar o arrasto.
        e.dataTransfer.setData('text/plain', lead.id)
        e.dataTransfer.effectAllowed = 'move'
        aoIniciarArrasto(lead)
      }}
      onDragEnd={aoTerminarArrasto}
      onClick={() => aoAbrir(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          aoAbrir(lead)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ficha de ${nomeExibido(lead)}`}
      className={cn(
        'flex cursor-grab flex-col gap-2 rounded-lg border border-borda bg-superficie p-3 shadow-cartao',
        'transition-colors hover:border-borda-forte active:cursor-grabbing',
        arrastando && 'opacity-40',
        destacado && 'lead-recem-movido',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-texto">
          {nomeExibido(lead)}
        </h4>
        {lead.tipo === 'cliente' && (
          <Badge variante="suave" className="shrink-0 px-2 py-0.5 text-[0.625rem]">
            Cliente
          </Badge>
        )}
      </div>

      {lead.codigo_imovel_interesse && (
        <p className="flex items-center gap-1.5 text-xs text-texto-suave">
          <Building2 className="size-3.5 shrink-0 text-texto-tenue" />
          <span className="truncate font-medium">{lead.codigo_imovel_interesse}</span>
          {!lead.imovel_interesse && (
            <span className="shrink-0 text-texto-tenue">· fora do cadastro</span>
          )}
        </p>
      )}

      {interesse && <p className="truncate text-xs text-texto-suave">{interesse}</p>}

      {/* `data_agendamento` é mantida pelo trigger 8: some sozinha quando
          a última visita do lead é cancelada. Por isso serve de
          indicador sem que a tela precise consultar a agenda. */}
      {lead.data_agendamento && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destaque">
          <CalendarCheck className="size-3.5 shrink-0" />
          Visita em {formatarData(new Date(lead.data_agendamento), fuso)}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-texto-tenue">
        <Clock className="size-3 shrink-0" />
        {lead.ultima_mensagem
          ? tempoRelativo(lead.ultima_mensagem)
          : `entrou ${tempoRelativo(lead.created_at)}`}
      </p>
    </article>
  )
}
