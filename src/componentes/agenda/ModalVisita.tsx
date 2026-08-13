import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Textarea } from '@/componentes/ui/textarea'
import { Campo } from '@/componentes/SecaoFormulario'
import { BuscaLead } from '@/componentes/agenda/BuscaLead'
import { BuscaImovel } from '@/componentes/agenda/BuscaImovel'
import {
  atualizarVisita,
  criarVisita,
  DURACAO_VISITA,
  MENSAGENS_INDISPONIVEL,
  verificarDisponibilidade,
  type ImovelResumo,
  type LeadResumo,
  type VisitaCompleta,
} from '@/lib/agendamentos'
import type { CorretorCompleto } from '@/lib/corretores'
import { corDoTextoSobre } from '@/lib/coresCorretores'
import {
  formatarDataPorExtenso,
  formatarHora,
  horaDeMinutos,
  instanteDe,
  minutosDeHora,
  partesNoFuso,
} from '@/lib/datas'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

interface Props {
  aberto: boolean
  aoFechar: () => void
  fuso: string
  /** Instante pré-preenchido, vindo do clique no slot vazio. */
  instanteInicial: Date | null
  /** Corretor pré-selecionado, vindo da coluna clicada na visão de dia. */
  corretorInicial?: string | null
  /** Lead pré-selecionado, vindo da ficha em `/painel/agenda?lead=…`. */
  leadInicial?: LeadResumo | null
  /** Visita em edição. Nulo na criação. */
  visita: VisitaCompleta | null
  corretores: CorretorCompleto[]
  visitasDoPeriodo: VisitaCompleta[]
  aoSalvar: () => Promise<void>
}

export function ModalVisita({
  aberto,
  aoFechar,
  fuso,
  instanteInicial,
  corretorInicial,
  leadInicial,
  visita,
  corretores,
  visitasDoPeriodo,
  aoSalvar,
}: Props) {
  const editando = Boolean(visita)

  const [lead, setLead] = useState<LeadResumo | null>(null)
  const [imovel, setImovel] = useState<ImovelResumo | null>(null)
  const [idCorretor, setIdCorretor] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erroLead, setErroLead] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return

    const base = visita ? new Date(visita.data_hora_inicio) : (instanteInicial ?? new Date())
    const p = partesNoFuso(base, fuso)

    setData(`${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`)
    setHora(horaDeMinutos(p.hora * 60 + p.minuto))
    setIdCorretor(visita?.id_corretor ?? corretorInicial ?? '')
    setObservacoes(visita?.observacoes ?? '')
    setErroLead(false)

    setLead(
      visita?.crm_imobiliaria
        ? {
            id: visita.crm_imobiliaria.id,
            nome: visita.crm_imobiliaria.nome,
            whatsapp: visita.crm_imobiliaria.whatsapp,
            status: '',
          }
        : (leadInicial ?? null),
    )

    setImovel(
      visita?.imoveis
        ? {
            id: visita.imoveis.id,
            codigo: visita.imoveis.codigo,
            titulo: visita.imoveis.titulo,
            bairro: visita.imoveis.bairro,
            cidade: '',
          }
        : null,
    )
  }, [aberto, visita, instanteInicial, corretorInicial, leadInicial, fuso])

  /** Instante escolhido, já convertido do fuso da imobiliária. */
  const inicio = useMemo(() => {
    if (!data || !hora) return null
    const [ano, mes, dia] = data.split('-').map(Number)
    const minutos = minutosDeHora(hora)
    return instanteDe(ano, mes, dia, Math.floor(minutos / 60), minutos % 60, fuso)
  }, [data, hora, fuso])

  /**
   * Situação de cada corretor no horário escolhido.
   *
   * Calculado no momento em que o usuário mexe na data, na hora ou no
   * corretor — e não ao salvar. Descobrir que o horário não serve
   * depois de preencher o modal inteiro é o tipo de atrito que faz o
   * corretor desistir de usar o painel e ligar para o colega.
   */
  const situacaoPorCorretor = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof verificarDisponibilidade>>()
    if (!inicio) return mapa

    for (const corretor of corretores) {
      mapa.set(
        corretor.id,
        verificarDisponibilidade(corretor, inicio, fuso, visitasDoPeriodo, visita?.id),
      )
    }
    return mapa
  }, [inicio, corretores, fuso, visitasDoPeriodo, visita?.id])

  const problemaDoEscolhido = idCorretor ? situacaoPorCorretor.get(idCorretor) : null
  const disponiveis = corretores.filter((c) => situacaoPorCorretor.get(c.id) === null).length

  async function salvar() {
    if (!lead) {
      setErroLead(true)
      notificar.erro('Escolha o lead', 'Toda visita precisa estar ligada a um lead.')
      return
    }
    if (!idCorretor) {
      notificar.erro('Escolha o corretor', 'Toda visita precisa de um responsável.')
      return
    }
    if (!inicio) {
      notificar.erro('Informe data e hora')
      return
    }

    setSalvando(true)
    try {
      if (visita) {
        await atualizarVisita(visita, {
          id_lead: lead.id,
          id_corretor: idCorretor,
          id_imovel: imovel?.id ?? null,
          data_hora_inicio: inicio,
          observacoes: observacoes.trim() || null,
        })
        notificar.sucesso('Visita atualizada')
      } else {
        await criarVisita({
          id_lead: lead.id,
          id_corretor: idCorretor,
          id_imovel: imovel?.id ?? null,
          data_hora_inicio: inicio,
          observacoes: observacoes.trim() || null,
        })
        notificar.sucesso(
          'Visita agendada',
          `${formatarDataPorExtenso(inicio, fuso)}, às ${formatarHora(inicio, fuso)}.`,
        )
      }

      await aoSalvar()
      aoFechar()
    } catch (erro) {
      // Os triggers 4 e 5 já devolvem mensagem pronta em português —
      // "Conflito de agenda: o corretor já possui uma visita das…".
      // Melhor exibir a do banco do que um texto genérico.
      notificar.erroDoBanco(erro, 'Não foi possível salvar a visita.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar visita' : 'Nova visita'}</DialogTitle>
          <DialogDescription>
            {inicio
              ? `${formatarDataPorExtenso(inicio, fuso)} · ${formatarHora(inicio, fuso)} às ${formatarHora(new Date(inicio.getTime() + DURACAO_VISITA * 60_000), fuso)}`
              : 'Blocos de 30 minutos.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          <Campo id="lead" rotulo="Lead" obrigatorio erro={erroLead ? 'Escolha um lead.' : undefined}>
            <BuscaLead
              selecionado={lead}
              aoSelecionar={(l) => {
                setLead(l)
                setErroLead(false)
              }}
              invalido={erroLead}
            />
          </Campo>

          <Campo id="imovel" rotulo="Imóvel" dica="Opcional — pode ser definido depois.">
            <BuscaImovel selecionado={imovel} aoSelecionar={setImovel} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="data" rotulo="Data" obrigatorio>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Campo>

            <Campo id="hora" rotulo="Horário" obrigatorio dica="Duração fixa de 30 minutos.">
              <Input
                id="hora"
                type="time"
                step={1800}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </Campo>
          </div>

          {/* ---------------- Corretor ---------------- */}
          <Campo
            id="corretor"
            rotulo="Corretor"
            obrigatorio
            dica={
              corretores.length > 0
                ? `${disponiveis} de ${corretores.length} disponíveis neste horário.`
                : undefined
            }
          >
            {corretores.length === 0 ? (
              <p className="rounded-lg border border-dashed border-borda-forte bg-superficie-alternativa px-3.5 py-4 text-center text-sm text-texto-suave">
                Nenhum corretor ativo. Cadastre a equipe antes de marcar visitas.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {corretores.map((corretor) => {
                  const problema = situacaoPorCorretor.get(corretor.id) ?? null
                  const escolhido = idCorretor === corretor.id

                  return (
                    <li key={corretor.id}>
                      <button
                        type="button"
                        onClick={() => setIdCorretor(corretor.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          escolhido
                            ? 'border-destaque bg-destaque-suave'
                            : 'border-borda hover:border-borda-forte hover:bg-superficie-alternativa',
                        )}
                      >
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold"
                          style={{
                            backgroundColor: corretor.cor,
                            color: corDoTextoSobre(corretor.cor),
                          }}
                        >
                          {corretor.nome.charAt(0).toUpperCase()}
                          {corretor.sobrenome.charAt(0).toUpperCase()}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-texto">
                            {corretor.nome} {corretor.sobrenome}
                          </span>
                          {problema ? (
                            <span className="flex items-center gap-1.5 text-xs text-alerta">
                              <AlertTriangle className="size-3 shrink-0" />
                              {MENSAGENS_INDISPONIVEL[problema]}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-sucesso">
                              <Check className="size-3 shrink-0" />
                              Disponível
                            </span>
                          )}
                        </span>

                        {escolhido && <Check className="size-4 shrink-0 text-destaque" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Campo>

          {/* Aviso, não bloqueio: quem manda é o banco, e ele pode ter
              mudado de opinião entre este cálculo e o insert. */}
          {problemaDoEscolhido && (
            <p className="flex items-start gap-2.5 rounded-lg border border-alerta/30 bg-alerta/8 px-3.5 py-3 text-sm text-texto-suave">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-alerta" />
              <span>
                <strong className="text-texto">
                  {MENSAGENS_INDISPONIVEL[problemaDoEscolhido]}.
                </strong>{' '}
                O banco vai recusar este agendamento. Escolha outro horário, outro dia ou outro
                corretor.
              </span>
            </p>
          )}

          <Campo id="observacoes" rotulo="Observações">
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ponto de encontro, chave na portaria, preferências do cliente…"
              rows={3}
            />
          </Campo>
        </DialogBody>

        <DialogFooter>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || corretores.length === 0}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Agendar visita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
