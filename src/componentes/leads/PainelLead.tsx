import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  CalendarPlus,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/componentes/ui/sheet'
import { Button } from '@/componentes/ui/button'
import { Select } from '@/componentes/ui/select'
import { Textarea } from '@/componentes/ui/textarea'
import { Badge } from '@/componentes/ui/badge'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { BadgeStatus } from '@/componentes/leads/BadgeStatus'
import { ROTULOS_STATUS_VISITA } from '@/lib/agendamentos'
import {
  buscarLead,
  ETAPAS_FUNIL,
  formatarWhatsapp,
  linkWhatsapp,
  listarVisitasDoLead,
  mudarStatusLead,
  nomeExibido,
  ROTULOS_TIPO_LEAD,
  salvarObservacoes,
  type Lead,
  type LeadComImovel,
  type StatusLead,
  type VisitaDoLead,
} from '@/lib/leads'
import { formatarDataHora, tempoRelativo } from '@/lib/datas'
import { formatarMoedaCurta, ROTULOS_FINALIDADE } from '@/lib/formato'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

interface Props {
  /** Id do lead aberto. Nulo mantém o painel fechado. */
  idLead: string | null
  aoFechar: () => void
  fuso: string
  /** Avisa a tela de origem para recarregar a lista ou a coluna. */
  aoAtualizar: () => void
  aoEditar: (lead: Lead) => void
  aoExcluir: (lead: Lead) => void
}

/**
 * Ficha do lead em painel lateral.
 *
 * **Componente único, usado por Leads e por Funil.** As duas telas são
 * visualizações da mesma tabela, e duplicar a ficha faria com que um
 * campo novo aparecesse em uma e não na outra — a forma mais silenciosa
 * de as duas telas passarem a discordar sobre o mesmo lead.
 *
 * Painel lateral e não página: o uso real é consultar vários leads em
 * sequência, e navegar para uma página a cada um perderia a lista, a
 * rolagem e o filtro a cada consulta.
 *
 * Recebe o id e busca os dados, em vez de receber o registro pronto: as
 * duas telas trazem o lead com recortes diferentes, e a ficha precisa
 * dos campos todos de qualquer forma.
 */
export function PainelLead({ idLead, aoFechar, fuso, aoAtualizar, aoEditar, aoExcluir }: Props) {
  const [lead, setLead] = useState<LeadComImovel | null>(null)
  const [visitas, setVisitas] = useState<VisitaDoLead[]>([])
  const [carregando, setCarregando] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)

  const carregar = useCallback(async () => {
    if (!idLead) return
    setCarregando(true)
    try {
      const [registro, historico] = await Promise.all([
        buscarLead(idLead),
        listarVisitasDoLead(idLead),
      ])
      setLead(registro)
      setVisitas(historico)
      setObservacoes(registro?.observacoes ?? '')
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar o lead.')
    } finally {
      setCarregando(false)
    }
  }, [idLead])

  useEffect(() => {
    if (!idLead) {
      setLead(null)
      setVisitas([])
      return
    }
    void carregar()
  }, [idLead, carregar])

  async function trocarStatus(status: StatusLead) {
    if (!lead || status === lead.status) return
    setMudandoStatus(true)
    try {
      const atualizado = await mudarStatusLead(lead, status)
      setLead((atual) => (atual ? { ...atual, ...atualizado } : atual))
      notificar.sucesso(
        'Etapa atualizada',
        // O banco decide o tipo: o trigger 7 promove a cliente quando o
        // status vira `visitou`. Aqui só se conta o que ele respondeu.
        atualizado.tipo === 'cliente' && lead.tipo !== 'cliente'
          ? 'O lead passou a ser cliente.'
          : undefined,
      )
      aoAtualizar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível mudar a etapa.')
    } finally {
      setMudandoStatus(false)
    }
  }

  async function gravarObservacoes() {
    if (!lead) return
    setSalvandoObs(true)
    try {
      const atualizado = await salvarObservacoes(lead, observacoes)
      setLead((atual) => (atual ? { ...atual, ...atualizado } : atual))
      notificar.sucesso('Observações salvas')
      aoAtualizar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível salvar as observações.')
    } finally {
      setSalvandoObs(false)
    }
  }

  const obsAlterada = lead ? observacoes.trim() !== (lead.observacoes ?? '').trim() : false
  const temAtendimento =
    lead &&
    (lead.motivo_contato || lead.resumo_conversa || lead.inicio_atendimento || lead.ultima_mensagem)

  return (
    <Sheet open={Boolean(idLead)} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent
        lado="direita"
        className="w-full sm:w-[32rem] sm:max-w-[92vw]"
        aria-describedby={undefined}
      >
        {carregando && !lead ? (
          <>
            <SheetTitle className="sr-only">Carregando lead</SheetTitle>
            <EstadoCarregando mensagem="Carregando a ficha…" />
          </>
        ) : !lead ? (
          <>
            <SheetTitle className="sr-only">Lead não encontrado</SheetTitle>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-texto-suave">
                Este lead não está mais cadastrado. Ele pode ter sido excluído por outro usuário.
              </p>
              <Button variante="secundario" onClick={aoFechar}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* ---------------- Cabeçalho ---------------- */}
            <header className="flex shrink-0 items-start gap-3 border-b border-borda p-5">
              <div className="min-w-0 flex-1">
                <SheetTitle className="titulo-secao truncate">{nomeExibido(lead)}</SheetTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <BadgeStatus status={lead.status} />
                  <Badge variante={lead.tipo === 'cliente' ? 'suave' : 'neutro'}>
                    {ROTULOS_TIPO_LEAD[lead.tipo] ?? lead.tipo}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-texto-tenue transition-colors hover:bg-superficie-alternativa hover:text-texto"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* ---------------- Corpo ---------------- */}
            <div className="flex-1 overflow-y-auto">
              {/* Identificação */}
              <Bloco titulo="Identificação">
                <Linha rotulo="WhatsApp">
                  <a
                    href={linkWhatsapp(lead.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-destaque hover:underline"
                  >
                    {formatarWhatsapp(lead.whatsapp)}
                    <ExternalLink className="size-3.5" />
                  </a>
                </Linha>
                <Linha rotulo="Nome">{lead.nome ?? <Vazio>não informado</Vazio>}</Linha>
                <Linha rotulo="Email">{lead.email ?? <Vazio>não informado</Vazio>}</Linha>
                <Linha rotulo="Origem">{lead.origem ?? <Vazio>não informada</Vazio>}</Linha>
                <Linha rotulo="Entrada">{formatarDataHora(new Date(lead.created_at), fuso)}</Linha>
              </Bloco>

              {/* Interesse */}
              <Bloco titulo="Interesse">
                <Linha rotulo="Imóvel">
                  {!lead.codigo_imovel_interesse ? (
                    <Vazio>nenhum imóvel específico</Vazio>
                  ) : lead.imovel_interesse ? (
                    <Link
                      to={`/painel/imoveis/${lead.imovel_interesse.id}/editar`}
                      className="inline-flex items-center gap-1.5 font-medium text-destaque hover:underline"
                    >
                      {lead.imovel_interesse.codigo}
                      <span className="truncate text-texto-suave">
                        · {lead.imovel_interesse.titulo}
                      </span>
                    </Link>
                  ) : (
                    // A exclusão de imóvel é definitiva e o código do
                    // lead sobrevive a ela. Link aqui levaria a lugar
                    // nenhum; o código sem link ainda conta a história.
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium text-texto">
                        {lead.codigo_imovel_interesse}
                      </span>
                      <span className="text-xs text-texto-tenue">
                        Este imóvel não está mais cadastrado.
                      </span>
                    </span>
                  )}
                </Linha>
                <Linha rotulo="Finalidade">
                  {lead.finalidade_interesse ? (
                    ROTULOS_FINALIDADE[lead.finalidade_interesse]
                  ) : (
                    <Vazio>não informada</Vazio>
                  )}
                </Linha>
                <Linha rotulo="Tipo">
                  {lead.tipo_imovel_interesse ?? <Vazio>não informado</Vazio>}
                </Linha>
                <Linha rotulo="Faixa de valor">
                  {lead.faixa_valor_min === null && lead.faixa_valor_max === null ? (
                    <Vazio>não informada</Vazio>
                  ) : (
                    [
                      lead.faixa_valor_min !== null && formatarMoedaCurta(lead.faixa_valor_min),
                      lead.faixa_valor_max !== null && formatarMoedaCurta(lead.faixa_valor_max),
                    ]
                      .filter(Boolean)
                      .join(' a ')
                  )}
                </Linha>
              </Bloco>

              {/* Atendimento pelo agente — só quando houver.
                  Lead cadastrado à mão nunca terá nenhum destes campos, e
                  uma seção inteira de traços não informa nada. */}
              {temAtendimento && (
                <Bloco
                  titulo="Atendimento pelo agente"
                  icone={<Bot className="size-4 text-destaque" />}
                >
                  {lead.motivo_contato && (
                    <Linha rotulo="Motivo">{lead.motivo_contato}</Linha>
                  )}
                  {lead.resumo_conversa && (
                    <Linha rotulo="Resumo" empilhado>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-texto-suave">
                        {lead.resumo_conversa}
                      </p>
                    </Linha>
                  )}
                  {lead.inicio_atendimento && (
                    <Linha rotulo="Início">
                      {formatarDataHora(new Date(lead.inicio_atendimento), fuso)}
                    </Linha>
                  )}
                  {lead.ultima_mensagem && (
                    <Linha rotulo="Última mensagem">
                      {tempoRelativo(lead.ultima_mensagem)}
                      <span className="ml-1.5 text-texto-tenue">
                        · {formatarDataHora(new Date(lead.ultima_mensagem), fuso)}
                      </span>
                    </Linha>
                  )}
                </Bloco>
              )}

              {/* Visitas */}
              <Bloco
                titulo="Visitas"
                acao={
                  <Button variante="secundario" tamanho="pequeno" asChild>
                    <Link to={`/painel/agenda?lead=${lead.id}`}>
                      <CalendarPlus className="size-3.5" />
                      Agendar
                    </Link>
                  </Button>
                }
              >
                {visitas.length === 0 ? (
                  <p className="text-sm text-texto-tenue">
                    Nenhuma visita registrada para este lead.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {visitas.map((visita) => (
                      <li
                        key={visita.id}
                        className="flex items-start gap-3 rounded-lg border border-borda px-3.5 py-3"
                      >
                        <span
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: visita.corretores?.cor ?? 'var(--borda-forte)' }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-texto">
                            {formatarDataHora(new Date(visita.data_hora_inicio), fuso)}
                          </p>
                          <p className="truncate text-xs text-texto-suave">
                            {visita.imoveis
                              ? `${visita.imoveis.codigo} · ${visita.imoveis.titulo}`
                              : visita.codigo_imovel
                                ? `${visita.codigo_imovel} · imóvel não cadastrado`
                                : 'Sem imóvel definido'}
                          </p>
                          <p className="text-xs text-texto-tenue">
                            {visita.corretores
                              ? `${visita.corretores.nome} ${visita.corretores.sobrenome}`
                              : 'Sem corretor'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                            visita.status === 'cancelada'
                              ? 'bg-destrutivo/10 text-destrutivo'
                              : visita.status === 'realizada'
                                ? 'bg-sucesso/12 text-sucesso'
                                : 'bg-superficie-alternativa text-texto-suave',
                          )}
                        >
                          {ROTULOS_STATUS_VISITA[visita.status] ?? visita.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>

              {/* Observações */}
              <Bloco titulo="Observações">
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="O que a equipe precisa saber sobre este contato."
                  rows={4}
                  aria-label="Observações do lead"
                />
                {obsAlterada && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variante="fantasma"
                      tamanho="pequeno"
                      onClick={() => setObservacoes(lead.observacoes ?? '')}
                      disabled={salvandoObs}
                    >
                      Descartar
                    </Button>
                    <Button
                      tamanho="pequeno"
                      onClick={() => void gravarObservacoes()}
                      disabled={salvandoObs}
                    >
                      {salvandoObs && <Loader2 className="size-3.5 animate-spin" />}
                      Salvar observações
                    </Button>
                  </div>
                )}
              </Bloco>

              {/* Etapa */}
              <Bloco titulo="Etapa do funil">
                <Select
                  value={lead.status}
                  onChange={(e) => void trocarStatus(e.target.value as StatusLead)}
                  disabled={mudandoStatus}
                  aria-label="Etapa do funil"
                >
                  {ETAPAS_FUNIL.map((etapa) => (
                    <option key={etapa.chave} value={etapa.chave}>
                      {etapa.rotulo}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-texto-tenue">
                  Mover para <strong>Visitou</strong> transforma o lead em cliente
                  automaticamente.
                </p>
              </Bloco>
            </div>

            {/* ---------------- Ações ---------------- */}
            <footer className="flex shrink-0 flex-wrap gap-2 border-t border-borda p-4">
              <Button variante="secundario" tamanho="pequeno" onClick={() => aoEditar(lead)}>
                <Pencil className="size-3.5" />
                Editar
              </Button>

              <Button
                variante="fantasma"
                tamanho="pequeno"
                onClick={() => aoExcluir(lead)}
                className="ml-auto text-destrutivo hover:bg-destrutivo/8 hover:text-destrutivo"
              >
                <Trash2 className="size-3.5" />
                Excluir
              </Button>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------- apoio */

function Bloco({
  titulo,
  icone,
  acao,
  children,
}: {
  titulo: string
  icone?: React.ReactNode
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-borda p-5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="rotulo-grupo flex items-center gap-2">
          {icone}
          {titulo}
        </h3>
        {acao}
      </div>
      {children}
    </section>
  )
}

function Linha({
  rotulo,
  empilhado,
  children,
}: {
  rotulo: string
  empilhado?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'gap-1',
        empilhado ? 'flex flex-col' : 'grid grid-cols-[7.5rem_1fr] items-start gap-x-3',
      )}
    >
      <span className="text-sm text-texto-tenue">{rotulo}</span>
      <span className="min-w-0 text-sm text-texto">{children}</span>
    </div>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <span className="text-texto-tenue">{children}</span>
}
