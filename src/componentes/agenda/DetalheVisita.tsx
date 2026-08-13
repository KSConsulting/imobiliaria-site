import { useEffect, useState } from 'react'
import {
  Ban,
  Bot,
  Building2,
  CalendarClock,
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import {
  ROTULOS_ORIGEM_VISITA,
  ROTULOS_STATUS_VISITA,
  type VisitaCompleta,
} from '@/lib/agendamentos'
import { corDoTextoSobre } from '@/lib/coresCorretores'
import { formatarDataHora, formatarDataPorExtenso, formatarHora, tempoRelativo } from '@/lib/datas'
import { buscarAtendimentoDoLead, type AtendimentoDoAgente } from '@/lib/leads'
import { cn } from '@/lib/utils'

interface Props {
  visita: VisitaCompleta | null
  fuso: string
  aoFechar: () => void
  aoEditar: (visita: VisitaCompleta) => void
  aoMudarStatus: (visita: VisitaCompleta, status: 'agendada' | 'realizada' | 'cancelada') => Promise<void>
  aoExcluir: (visita: VisitaCompleta) => void
}

export function DetalheVisita({
  visita,
  fuso,
  aoFechar,
  aoEditar,
  aoMudarStatus,
  aoExcluir,
}: Props) {
  const [processando, setProcessando] = useState<string | null>(null)
  const [atendimento, setAtendimento] = useState<AtendimentoDoAgente | null>(null)
  const [carregandoAtendimento, setCarregandoAtendimento] = useState(false)

  // A visita marcada à mão no painel não tem conversa nenhuma por trás,
  // então nem a consulta acontece.
  const veioDoAgente = visita?.origem === 'agente_ia'
  const idLead = visita?.crm_imobiliaria?.id ?? null

  useEffect(() => {
    if (!veioDoAgente || !idLead) {
      setAtendimento(null)
      return
    }

    // A visita seguinte que o usuário abrir pode responder antes desta.
    // Sem a guarda, o resumo de uma apareceria dentro da outra.
    let atual = true
    setCarregandoAtendimento(true)

    buscarAtendimentoDoLead(idLead)
      .then((dados) => atual && setAtendimento(dados))
      .catch(() => atual && setAtendimento(null))
      .finally(() => atual && setCarregandoAtendimento(false))

    return () => {
      atual = false
    }
  }, [veioDoAgente, idLead])

  if (!visita) return null

  const inicio = new Date(visita.data_hora_inicio)
  const fim = new Date(visita.data_hora_fim)
  const jaPassou = fim.getTime() < Date.now()
  const cor = visita.corretores?.cor ?? '#57534E'
  const cancelada = visita.status === 'cancelada'
  const realizada = visita.status === 'realizada'

  async function executar(status: 'agendada' | 'realizada' | 'cancelada') {
    if (!visita) return
    setProcessando(status)
    try {
      await aoMudarStatus(visita, status)
    } finally {
      setProcessando(null)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !processando && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2.5">
            <DialogTitle>Visita</DialogTitle>
            <Badge
              variante={
                cancelada ? 'inativo' : realizada ? 'suave' : visita.status === 'reagendada' ? 'neutro' : 'destaque'
              }
            >
              {ROTULOS_STATUS_VISITA[visita.status]}
            </Badge>
            {visita.origem && ROTULOS_ORIGEM_VISITA[visita.origem] && (
              <Badge variante="neutro">{ROTULOS_ORIGEM_VISITA[visita.origem]}</Badge>
            )}
          </div>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          {/* ---------------- Quando ---------------- */}
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-texto-tenue" />
            <div>
              <p className={cn('font-medium text-texto', cancelada && 'line-through')}>
                {formatarDataPorExtenso(inicio, fuso)}
              </p>
              <p className="text-sm text-texto-suave">
                {formatarHora(inicio, fuso)} às {formatarHora(fim, fuso)}
              </p>
            </div>
          </div>

          {/* ---------------- Lead ---------------- */}
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 size-4 shrink-0 text-texto-tenue" />
            <div className="min-w-0">
              <p className="font-medium text-texto">
                {visita.crm_imobiliaria?.nome ?? 'Lead sem nome'}
              </p>
              {visita.crm_imobiliaria?.whatsapp && (
                <a
                  href={`https://wa.me/${visita.crm_imobiliaria.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-destaque hover:underline"
                >
                  <Phone className="size-3.5" />
                  {visita.crm_imobiliaria.whatsapp}
                </a>
              )}
            </div>
          </div>

          {/* ---------------- Imóvel ---------------- */}
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-4 shrink-0 text-texto-tenue" />
            <div className="min-w-0">
              {visita.codigo_imovel ? (
                <>
                  <p className="font-medium text-texto">
                    <span className="font-mono text-sm text-texto-suave">
                      {visita.codigo_imovel}
                    </span>{' '}
                    {visita.imoveis?.titulo ?? ''}
                  </p>
                  {visita.imoveis ? (
                    <p className="text-sm text-texto-suave">{visita.imoveis.bairro}</p>
                  ) : (
                    // O imóvel saiu do banco, mas o código copiado no
                    // agendamento preserva o histórico da visita.
                    <p className="text-sm text-texto-tenue">
                      Este imóvel foi excluído. O código fica registrado para histórico.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-texto-tenue">Imóvel ainda não definido</p>
              )}
            </div>
          </div>

          {/* ---------------- Corretor ---------------- */}
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] font-bold"
              style={{ backgroundColor: cor, color: corDoTextoSobre(cor) }}
            >
              {visita.corretores?.nome.charAt(0).toUpperCase()}
            </span>
            <p className="font-medium text-texto">
              {visita.corretores
                ? `${visita.corretores.nome} ${visita.corretores.sobrenome}`
                : 'Sem corretor'}
            </p>
          </div>

          {/* ---------------- Observações ---------------- */}
          {visita.observacoes && (
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-texto-tenue" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-texto-suave">
                {visita.observacoes}
              </p>
            </div>
          )}

          {/* ---------------- Atendimento pelo agente ---------------- */}
          {/* Só nas visitas que o agente marcou. Quem marcou pelo painel
              estava com a pessoa na linha e não tem conversa para ler. */}
          {veioDoAgente && (
            <div className="rounded-xl border border-borda bg-superficie-alternativa px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Bot className="size-4 shrink-0 text-destaque" />
                <p className="rotulo-grupo">Atendimento pelo agente</p>
              </div>

              <div className="mt-2.5">
                {carregandoAtendimento ? (
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                  </div>
                ) : atendimento?.resumo_conversa || atendimento?.motivo_contato ? (
                  <div className="flex flex-col gap-2.5">
                    {atendimento.motivo_contato && (
                      <p className="text-sm text-texto">
                        <span className="text-texto-tenue">Motivo: </span>
                        {atendimento.motivo_contato}
                      </p>
                    )}
                    {atendimento.resumo_conversa && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-texto-suave">
                        {atendimento.resumo_conversa}
                      </p>
                    )}
                    {atendimento.ultima_mensagem && (
                      // Recalculado do instante, nunca lido de
                      // minutos_ultima_mensagem, que é um retrato do
                      // momento da gravação e envelhece parado.
                      <p className="text-xs text-texto-tenue">
                        Última mensagem {tempoRelativo(atendimento.ultima_mensagem)} ·{' '}
                        {formatarDataHora(new Date(atendimento.ultima_mensagem), fuso)}
                      </p>
                    )}
                  </div>
                ) : (
                  // O selo no topo promete uma conversa. Sem esta linha,
                  // o bloco vazio pareceria falha de carregamento.
                  <p className="text-sm text-texto-tenue">
                    O agente não gravou resumo desta conversa.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ---------------- Ações de status ---------------- */}
          <div className="flex flex-wrap gap-2 border-t border-borda pt-5">
            {!realizada && jaPassou && !cancelada && (
              <Button
                variante="secundario"
                tamanho="pequeno"
                onClick={() => void executar('realizada')}
                disabled={Boolean(processando)}
              >
                {processando === 'realizada' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Marcar como realizada
              </Button>
            )}

            {!cancelada && (
              <Button
                variante="secundario"
                tamanho="pequeno"
                onClick={() => void executar('cancelada')}
                disabled={Boolean(processando)}
              >
                {processando === 'cancelada' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Ban className="size-3.5" />
                )}
                Cancelar visita
              </Button>
            )}

            {cancelada && (
              <Button
                variante="secundario"
                tamanho="pequeno"
                onClick={() => void executar('agendada')}
                disabled={Boolean(processando)}
              >
                {processando === 'agendada' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="size-3.5" />
                )}
                Reabrir visita
              </Button>
            )}
          </div>

          {/* O funil é do banco. Aqui só se explica o que vai acontecer. */}
          <p className="text-xs leading-relaxed text-texto-tenue">
            Mudar o status desta visita atualiza o lead automaticamente. Cancelar só rebaixa o
            lead se não restar nenhuma outra visita agendada para ele; marcar como realizada o
            promove a cliente.
          </p>
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <Button
            variante="fantasma"
            onClick={() => aoExcluir(visita)}
            disabled={Boolean(processando)}
            className="text-destrutivo hover:bg-destrutivo/8"
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>

          <div className="flex gap-2">
            <Button variante="secundario" onClick={aoFechar} disabled={Boolean(processando)}>
              Fechar
            </Button>
            <Button onClick={() => aoEditar(visita)} disabled={Boolean(processando)}>
              <Pencil className="size-4" />
              Editar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
