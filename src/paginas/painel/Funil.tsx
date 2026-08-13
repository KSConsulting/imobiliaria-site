import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Columns3, Plus, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AlternadorLeadsFunil } from '@/componentes/AlternadorLeadsFunil'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { BarraFiltrosLead } from '@/componentes/leads/BarraFiltrosLead'
import { ColunaFunil, COLUNA_VAZIA, type EstadoColuna } from '@/componentes/leads/ColunaFunil'
import { ModalLead } from '@/componentes/leads/ModalLead'
import { PainelLead } from '@/componentes/leads/PainelLead'
import { usarFiltrosLead } from '@/ganchos/usarFiltrosLead'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import {
  contarLeads,
  contarVisitasDoLead,
  ETAPAS_FUNIL,
  excluirLead,
  listarColunaFunil,
  listarOrigens,
  mudarStatusLead,
  nomeExibido,
  PAGINA_FUNIL,
  soMudouORelogio,
  statusSelecionados,
  temFiltroLeadAtivo,
  type EtapaFunil,
  type Lead,
  type LeadComImovel,
  type StatusLead,
} from '@/lib/leads'
import { FUSO_PADRAO } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { notificar } from '@/lib/notificacoes'

type EstadoFunil = Record<string, EstadoColuna>

/** Duração do pulso do card que se moveu sozinho. Casa com o CSS. */
const DURACAO_DESTAQUE = 2600

function estadoInicial(): EstadoFunil {
  return Object.fromEntries(ETAPAS_FUNIL.map((etapa) => [etapa.chave, { ...COLUNA_VAZIA }]))
}

export function Funil() {
  const { configuracoes } = usarConfiguracoes()
  const fuso = configuracoes?.fuso_horario ?? FUSO_PADRAO

  const { filtros, definirFiltro, alternarStatus, limparFiltros } = usarFiltrosLead()

  const [estado, setEstado] = useState<EstadoFunil>(estadoInicial)
  const [origens, setOrigens] = useState<string[]>([])
  const [totalCadastrado, setTotalCadastrado] = useState(0)
  const [destacados, setDestacados] = useState<Set<string>>(new Set())

  const [idAberto, setIdAberto] = useState<string | null>(null)
  const [emEdicao, setEmEdicao] = useState<Lead | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Lead | null>(null)
  const [visitasDoExcluir, setVisitasDoExcluir] = useState(0)

  const [arrastado, setArrastado] = useState<LeadComImovel | null>(null)

  /**
   * Ids que esta aba acabou de gravar.
   *
   * O Realtime devolve a própria escrita. Sem essa marca, arrastar um
   * card faria o pulso de "mudou sozinho" disparar no card que o próprio
   * usuário acabou de mover — o aviso perde o sentido se aparece também
   * quando não há nada de novo para avisar.
   */
  const proprias = useRef<Set<string>>(new Set())

  const filtroAtivo = useMemo(() => temFiltroLeadAtivo(filtros), [filtros])

  /**
   * Colunas exibidas.
   *
   * O filtro de status vem da tela de Leads pelo alternador. No Kanban
   * ele não filtra os cards — as colunas já são o status — então passa a
   * escolher quais colunas aparecem. É o que dá um sentido honesto a um
   * filtro que, de outra forma, seria descartado em silêncio na troca de
   * tela.
   */
  const etapasVisiveis = useMemo(() => {
    const escolhidos = statusSelecionados(filtros)
    if (escolhidos.length === 0) return ETAPAS_FUNIL
    return ETAPAS_FUNIL.filter((etapa) => escolhidos.includes(etapa.chave))
  }, [filtros])

  /* ------------------------------------------------------------ carga */

  // Espelho do estado, para ler o deslocamento da paginação sem colocar
  // `estado` nas dependências de `carregarColuna` — a cada card
  // carregado a função seria recriada, o efeito de carga rodaria de novo
  // e a paginação voltaria à primeira página, em laço.
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  const carregarColuna = useCallback(
    async (status: StatusLead, anexar = false) => {
      setEstado((atual) => ({
        ...atual,
        [status]: {
          ...atual[status],
          carregando: anexar ? atual[status].carregando : true,
          carregandoMais: anexar,
        },
      }))

      try {
        const deslocamento = anexar ? estadoRef.current[status].leads.length : 0
        const { leads, total } = await listarColunaFunil(
          status,
          filtros,
          deslocamento,
          PAGINA_FUNIL,
        )

        setEstado((atual) => {
          const anteriores = anexar ? atual[status].leads : []
          // Deduplica por id: entre a página anterior e esta, um lead
          // pode ter mudado de etapa e deslocado a janela do `range`.
          const vistos = new Set(anteriores.map((lead) => lead.id))
          return {
            ...atual,
            [status]: {
              leads: [...anteriores, ...leads.filter((lead) => !vistos.has(lead.id))],
              total,
              carregando: false,
              carregandoMais: false,
            },
          }
        })
      } catch (erro) {
        notificar.erroDoBanco(erro, `Não foi possível carregar a etapa ${status}.`)
        setEstado((atual) => ({
          ...atual,
          [status]: { ...atual[status], carregando: false, carregandoMais: false },
        }))
      }
    },
    [filtros],
  )

  const carregarTudo = useCallback(async () => {
    await Promise.all(ETAPAS_FUNIL.map((etapa) => carregarColuna(etapa.chave)))
  }, [carregarColuna])

  useEffect(() => {
    const atraso = filtros.busca ? 300 : 0
    const tempo = setTimeout(() => void carregarTudo(), atraso)
    return () => clearTimeout(tempo)
  }, [carregarTudo, filtros.busca])

  useEffect(() => {
    void (async () => {
      try {
        const [total, lista] = await Promise.all([contarLeads(), listarOrigens()])
        setTotalCadastrado(total)
        setOrigens(lista)
      } catch (erro) {
        console.warn('[funil] falha ao carregar apoio:', erro)
      }
    })()
  }, [])

  /* --------------------------------------------------------- realtime */
  const destacar = useCallback((id: string) => {
    setDestacados((atuais) => new Set(atuais).add(id))
    setTimeout(() => {
      setDestacados((atuais) => {
        const proximo = new Set(atuais)
        proximo.delete(id)
        return proximo
      })
    }, DURACAO_DESTAQUE)
  }, [])

  useEffect(() => {
    const canal = supabase
      .channel('funil-crm')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_imobiliaria' },
        (payload) => {
          const anterior = payload.old as Partial<Lead> | null
          const novo = payload.new as Partial<Lead> | null
          const id = novo?.id ?? anterior?.id
          if (!id) return

          // O job de minutos reescreve todo lead com conversa a cada
          // minuto. Isso chega aqui como um UPDATE por lead, e sem esta
          // saída antecipada o Funil recarregaria as colunas sozinho o
          // tempo inteiro, desfazendo a paginação de quem estivesse
          // usando a tela.
          if (payload.eventType === 'UPDATE' && soMudouORelogio(anterior, novo)) return

          // Só as colunas envolvidas são recarregadas. Recarregar as sete
          // a cada mensagem do agente de IA transformaria uma conversa
          // movimentada em uma enxurrada de consultas.
          const afetadas = new Set<string>()
          if (novo?.status) afetadas.add(novo.status)
          if (anterior?.status) afetadas.add(anterior.status)
          if (afetadas.size === 0) ETAPAS_FUNIL.forEach((e) => afetadas.add(e.chave))

          for (const status of afetadas) void carregarColuna(status as StatusLead)

          const foiNossa = proprias.current.has(id)
          if (foiNossa) return

          if (payload.eventType === 'INSERT') {
            destacar(id)
            notificar.informacao(
              'Novo lead',
              novo?.nome ?? novo?.whatsapp ?? 'Contato criado pelo agente de IA.',
            )
          } else if (
            payload.eventType === 'UPDATE' &&
            anterior?.status &&
            novo?.status &&
            anterior.status !== novo.status
          ) {
            destacar(id)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarColuna, destacar])

  /* ------------------------------------------------------------ ações */

  /**
   * Solta o card em outra coluna.
   *
   * A interface se move primeiro e o banco confirma depois: arrastar
   * precisa parecer instantâneo, senão o usuário arrasta de novo achando
   * que não pegou. Se a gravação falhar, o estado inteiro volta ao
   * retrato tirado antes do movimento — reverter card a card deixaria a
   * contagem das colunas errada.
   *
   * O que acontece com o lead depois disso é do banco: mover para
   * `visitou` dispara o trigger 7, que o promove a cliente. Por isso o
   * card é substituído pela linha relida, e não pela que enviamos.
   */
  async function soltarEm(etapa: EtapaFunil) {
    const lead = arrastado
    setArrastado(null)
    if (!lead || lead.status === etapa.chave) return

    const retrato = estado
    const origem = lead.status

    setEstado((atual) => ({
      ...atual,
      [origem]: {
        ...atual[origem],
        leads: atual[origem].leads.filter((item) => item.id !== lead.id),
        total: Math.max(0, atual[origem].total - 1),
      },
      [etapa.chave]: {
        ...atual[etapa.chave],
        leads: [{ ...lead, status: etapa.chave }, ...atual[etapa.chave].leads],
        total: atual[etapa.chave].total + 1,
      },
    }))

    proprias.current.add(lead.id)

    try {
      const atualizado = await mudarStatusLead(lead, etapa.chave)

      setEstado((atual) => ({
        ...atual,
        [etapa.chave]: {
          ...atual[etapa.chave],
          leads: atual[etapa.chave].leads.map((item) =>
            item.id === lead.id ? { ...item, ...atualizado } : item,
          ),
        },
      }))

      notificar.sucesso(
        `${nomeExibido(lead)} → ${etapa.rotulo}`,
        atualizado.tipo === 'cliente' && lead.tipo !== 'cliente'
          ? 'O lead passou a ser cliente.'
          : undefined,
      )
    } catch (erro) {
      setEstado(retrato)
      notificar.erroDoBanco(erro, 'Não foi possível mover o lead. O card voltou para a etapa anterior.')
    } finally {
      setTimeout(() => proprias.current.delete(lead.id), DURACAO_DESTAQUE)
    }
  }

  function abrirEdicao(lead: Lead) {
    setIdAberto(null)
    setEmEdicao(lead)
    setModalAberto(true)
  }

  async function abrirExclusao(lead: Lead) {
    setIdAberto(null)
    setParaExcluir(lead)
    setVisitasDoExcluir(await contarVisitasDoLead(lead.id))
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirLead(paraExcluir)
      notificar.sucesso('Lead excluído', `${nomeExibido(paraExcluir)} foi removido do CRM.`)
      setParaExcluir(null)
      await carregarColuna(paraExcluir.status as StatusLead)
      setTotalCadastrado(await contarLeads())
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível excluir o lead.')
    }
  }

  const carregandoTudo = ETAPAS_FUNIL.every((etapa) => estado[etapa.chave].carregando)
  const totalVisivel = etapasVisiveis.reduce((soma, etapa) => soma + estado[etapa.chave].total, 0)
  const vazio = !carregandoTudo && totalVisivel === 0
  const colunasOcultas = ETAPAS_FUNIL.length - etapasVisiveis.length

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Funil</h2>
          <p className="texto-apoio">
            Os mesmos contatos da tela de Leads, por etapa. Os cards se movem sozinhos quando o
            agente de IA muda o status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AlternadorLeadsFunil />
          <Button
            onClick={() => {
              setEmEdicao(null)
              setModalAberto(true)
            }}
          >
            <Plus className="size-4" />
            Novo lead
          </Button>
        </div>
      </div>

      <BarraFiltrosLead
        filtros={filtros}
        definirFiltro={definirFiltro}
        alternarStatus={alternarStatus}
        limparFiltros={limparFiltros}
        origens={origens}
        temFiltro={filtroAtivo}
        compacta
      />

      {/* Colunas escondidas por um filtro de status trazido da tela de
          Leads. Sem este aviso, o Kanban pareceria ter perdido etapas. */}
      {colunasOcultas > 0 && (
        <div className="-mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-borda bg-superficie px-3.5 py-2.5 text-sm text-texto-suave">
          <span>
            Exibindo {etapasVisiveis.length} de {ETAPAS_FUNIL.length} etapas, por causa do filtro
            trazido da tela de Leads.
          </span>
          <Button
            variante="fantasma"
            tamanho="pequeno"
            onClick={() => definirFiltro('status', '')}
            className="ml-auto"
          >
            <X className="size-3.5" />
            Mostrar todas
          </Button>
        </div>
      )}

      {/* ---------------- Kanban ---------------- */}
      {vazio ? (
        <div className="cartao">
          <EstadoVazio
            icone={Columns3}
            titulo={filtroAtivo ? 'Nenhum lead para esses filtros' : 'O funil ainda está vazio'}
            descricao={
              filtroAtivo
                ? 'Nenhum contato corresponde à combinação aplicada. Tente afrouxar algum critério.'
                : 'Os leads aparecem aqui assim que chegarem — o agente de IA cria o contato e o card entra na coluna Novo sem ninguém recarregar a página.'
            }
            acao={
              filtroAtivo
                ? { rotulo: 'Limpar filtros', aoClicar: limparFiltros }
                : {
                    rotulo: 'Cadastrar lead',
                    aoClicar: () => {
                      setEmEdicao(null)
                      setModalAberto(true)
                    },
                  }
            }
          />
        </div>
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
          {etapasVisiveis.map((etapa) => (
            <ColunaFunil
              key={etapa.chave}
              etapa={etapa}
              estado={estado[etapa.chave]}
              fuso={fuso}
              destacados={destacados}
              idArrastado={arrastado?.id ?? null}
              aoAbrir={(lead) => setIdAberto(lead.id)}
              aoIniciarArrasto={setArrastado}
              aoTerminarArrasto={() => setArrastado(null)}
              aoSoltar={(destino) => void soltarEm(destino)}
              aoCarregarMais={(alvo) => void carregarColuna(alvo.chave, true)}
            />
          ))}
        </div>
      )}

      {!vazio && (
        <p className="text-xs text-texto-tenue">
          Arraste um card para mudar a etapa · {totalVisivel}{' '}
          {totalVisivel === 1 ? 'lead' : 'leads'} nas etapas exibidas
          {totalCadastrado > totalVisivel && (
            <span> · {totalCadastrado} no total</span>
          )}
        </p>
      )}

      {/* ---------------- Ficha e modais ---------------- */}
      <PainelLead
        idLead={idAberto}
        aoFechar={() => setIdAberto(null)}
        fuso={fuso}
        aoAtualizar={() => void carregarTudo()}
        aoEditar={abrirEdicao}
        aoExcluir={(lead) => void abrirExclusao(lead)}
      />

      <ModalLead
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        lead={emEdicao}
        aoSalvar={() => {
          void carregarTudo()
          void (async () => {
            setTotalCadastrado(await contarLeads())
            setOrigens(await listarOrigens())
          })()
        }}
        aoAbrirExistente={setIdAberto}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="lead"
          nomeItem={nomeExibido(paraExcluir)}
          aviso={
            visitasDoExcluir > 0
              ? `O contato sai do CRM e ${visitasDoExcluir === 1 ? 'a visita ligada a ele será excluída e desaparecerá' : `as ${visitasDoExcluir} visitas ligadas a ele serão excluídas e desaparecerão`} da agenda.`
              : 'O contato sai do CRM e o histórico da conversa com o agente de IA vai junto.'
          }
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}
