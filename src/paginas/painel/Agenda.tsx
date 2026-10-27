import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { FiltroCorretores } from '@/componentes/agenda/FiltroCorretores'
import { VisaoSemana } from '@/componentes/agenda/VisaoSemana'
import { VisaoDia } from '@/componentes/agenda/VisaoDia'
import { VisaoMes } from '@/componentes/agenda/VisaoMes'
import { ModalVisita } from '@/componentes/agenda/ModalVisita'
import { DetalheVisita } from '@/componentes/agenda/DetalheVisita'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import {
  buscarLeadResumo,
  buscarVisita,
  excluirVisita,
  listarVisitas,
  moverVisita,
  mudarStatusVisita,
  STATUS_TODAS,
  type LeadResumo,
  type VisitaCompleta,
} from '@/lib/agendamentos'
import { janelaDoDia, listarCorretoresAtivos, type CorretorCompleto } from '@/lib/corretores'
import {
  formatarData,
  formatarDataPorExtenso,
  FUSO_PADRAO,
  fusoDoNavegador,
  inicioDaSemana,
  inicioDoDia,
  inicioDoMes,
  NOMES_MESES,
  partesNoFuso,
  somarDias,
  somarMeses,
} from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

type Visao = 'semana' | 'dia' | 'mes'

/** Faixa mínima exibida, mesmo sem janela cadastrada. */
const MINUTO_MINIMO = 7 * 60
const MINUTO_MAXIMO = 20 * 60

export function Agenda() {
  const { configuracoes } = usarConfiguracoes()
  const fuso = configuracoes?.fuso_horario ?? FUSO_PADRAO

  const [parametros, definirParametros] = useSearchParams()
  const irPara = useNavigate()
  const [referencia, setReferencia] = useState(() => new Date())
  const [visao, setVisao] = useState<Visao>(() => visaoInicial())

  const [corretores, setCorretores] = useState<CorretorCompleto[]>([])
  const [visitas, setVisitas] = useState<VisitaCompleta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recemChegadas, setRecemChegadas] = useState<Set<string>>(new Set())

  const [modalAberto, setModalAberto] = useState(false)
  const [instanteInicial, setInstanteInicial] = useState<Date | null>(null)
  const [corretorInicial, setCorretorInicial] = useState<string | null>(null)
  const [leadInicial, setLeadInicial] = useState<LeadResumo | null>(null)
  const [emEdicao, setEmEdicao] = useState<VisitaCompleta | null>(null)
  const [emDetalhe, setEmDetalhe] = useState<VisitaCompleta | null>(null)
  const [paraExcluir, setParaExcluir] = useState<VisitaCompleta | null>(null)

  const arrastada = useRef<VisitaCompleta | null>(null)

  const selecionados = useMemo(
    () => (parametros.get('corretores') ?? '').split(',').filter(Boolean),
    [parametros],
  )
  const filtroStatus = parametros.get('status') ?? ''

  /* ---------------------------------------------------------- período */
  const periodo = useMemo(() => {
    if (visao === 'dia') {
      const inicio = inicioDoDia(referencia, fuso)
      return { inicio, fim: somarDias(inicio, 1, fuso) }
    }
    if (visao === 'semana') {
      const inicio = inicioDaSemana(referencia, fuso)
      return { inicio, fim: somarDias(inicio, 7, fuso) }
    }
    // O mês exibe seis semanas completas, então carrega além das bordas.
    const primeiro = inicioDoMes(referencia, fuso)
    const inicio = inicioDaSemana(primeiro, fuso)
    return { inicio, fim: somarDias(inicio, 42, fuso) }
  }, [referencia, visao, fuso])

  /* ---------------------------------------------------------- carga */
  const carregarVisitas = useCallback(async () => {
    try {
      setVisitas(await listarVisitas(periodo.inicio, periodo.fim))
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar a agenda.')
    } finally {
      setCarregando(false)
    }
  }, [periodo.inicio, periodo.fim])

  useEffect(() => {
    void carregarVisitas()
  }, [carregarVisitas])

  useEffect(() => {
    void (async () => {
      try {
        setCorretores(await listarCorretoresAtivos())
      } catch (erro) {
        notificar.erroDoBanco(erro, 'Não foi possível carregar os corretores.')
      }
    })()
  }, [])

  /**
   * Chegada pela ficha do lead: `/painel/agenda?lead=<id>`.
   *
   * A ficha manda agendar e a Agenda abre o modal com o lead já
   * escolhido. O parâmetro é consumido logo em seguida — deixá-lo na URL
   * faria o modal reabrir a cada volta para a Agenda, inclusive depois
   * de a visita já ter sido marcada.
   */
  useEffect(() => {
    const idLead = parametros.get('lead')
    if (!idLead) return

    void (async () => {
      try {
        const lead = await buscarLeadResumo(idLead)
        if (!lead) {
          notificar.aviso('Lead não encontrado', 'Ele pode ter sido excluído.')
          return
        }
        setLeadInicial(lead)
        setEmEdicao(null)
        setInstanteInicial(proximoSlot(fuso))
        setCorretorInicial(null)
        setModalAberto(true)
      } catch (erro) {
        notificar.erroDoBanco(erro, 'Não foi possível abrir o agendamento do lead.')
      } finally {
        definirParametros(
          (anterior) => {
            const proximo = new URLSearchParams(anterior)
            proximo.delete('lead')
            return proximo
          },
          { replace: true },
        )
      }
    })()
  }, [parametros, definirParametros, fuso])

  /* ------------------------------------------------------- realtime */
  useEffect(() => {
    const canal = supabase
      .channel('agenda-agendamentos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        (payload) => {
          const id =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id

          void (async () => {
            await carregarVisitas()

            // Bloco novo aparecendo do nada confunde. O destaque some
            // sozinho depois de alguns segundos.
            if (payload.eventType === 'INSERT' && id) {
              setRecemChegadas((atuais) => new Set(atuais).add(id))
              setTimeout(() => {
                setRecemChegadas((atuais) => {
                  const proximo = new Set(atuais)
                  proximo.delete(id)
                  return proximo
                })
              }, 6000)

              const nova = await buscarVisita(id)
              if (nova?.origem === 'agente_ia') {
                notificar.informacao(
                  'Nova visita pelo agente de IA',
                  `${nova.crm_imobiliaria?.nome ?? nova.crm_imobiliaria?.whatsapp ?? 'Lead'} · ${formatarData(new Date(nova.data_hora_inicio), fuso)}`,
                )
              }
            }
          })()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarVisitas, fuso])

  /* ------------------------------------------------------- filtragem */
  const corretoresVisiveis = useMemo(
    () =>
      selecionados.length === 0
        ? corretores
        : corretores.filter((c) => selecionados.includes(c.id)),
    [corretores, selecionados],
  )

  /**
   * Visita cancelada fica fora da grade por padrão.
   *
   * A agenda responde "o que vai acontecer", e cancelada não vai
   * acontecer: o bloco ocupa visualmente um horário que está livre, e a
   * hachura é lida como bloco antes de ser lida como cancelamento. A
   * visão de mês já as excluía desde a Etapa 4 — era o padrão da semana
   * e do dia que estava fora de linha.
   *
   * **Continuam alcançáveis pelo filtro, e isso não é zelo.** `reabrir`,
   * em `DetalheVisita`, só existe a partir do bloco na grade: sem
   * caminho de volta, a ação viraria código morto e uma visita cancelada
   * por engano não teria como ser recuperada pelo painel.
   *
   * O cálculo de disponibilidade não passa por aqui e não muda: ele
   * recebe `visitas` cru e já descarta o que não é `agendada` nem
   * `realizada`. Ver `verificarDisponibilidade`.
   */
  const visitasVisiveis = useMemo(
    () =>
      visitas.filter((visita) => {
        if (selecionados.length > 0 && !selecionados.includes(visita.id_corretor)) return false
        if (filtroStatus === STATUS_TODAS) return true
        if (!filtroStatus) return visita.status !== 'cancelada'
        return visita.status === filtroStatus
      }),
    [visitas, selecionados, filtroStatus],
  )

  /** Faixa de horas exibida: a união das janelas dos corretores visíveis. */
  const faixa = useMemo(() => {
    let inicio = Number.POSITIVE_INFINITY
    let fim = Number.NEGATIVE_INFINITY

    for (const corretor of corretoresVisiveis) {
      for (let dia = 0; dia < 7; dia++) {
        const janela = janelaDoDia(corretor, dia)
        if (!janela) continue
        inicio = Math.min(inicio, janela.inicio)
        fim = Math.max(fim, janela.fim)
      }
    }

    // Visitas fora da janela existem: o corretor pode ter mudado o
    // horário depois de já ter compromissos marcados. Elas precisam
    // continuar visíveis, senão somem da agenda sem explicação.
    for (const visita of visitasVisiveis) {
      const p = partesNoFuso(new Date(visita.data_hora_inicio), fuso)
      inicio = Math.min(inicio, p.hora * 60)
      fim = Math.max(fim, p.hora * 60 + 60)
    }

    if (!Number.isFinite(inicio)) return { inicio: 8 * 60, fim: 19 * 60 }

    return {
      inicio: Math.max(0, Math.min(inicio, MINUTO_MINIMO)),
      fim: Math.min(24 * 60, Math.max(fim, MINUTO_MAXIMO)),
    }
  }, [corretoresVisiveis, visitasVisiveis, fuso])

  /* --------------------------------------------------------- ações */
  function alternarCorretor(id: string) {
    const proximos = selecionados.includes(id)
      ? selecionados.filter((s) => s !== id)
      : [...selecionados, id]
    atualizarParametro('corretores', proximos.join(','))
  }

  function atualizarParametro(chave: string, valor: string) {
    definirParametros(
      (anterior) => {
        const proximo = new URLSearchParams(anterior)
        if (valor) proximo.set(chave, valor)
        else proximo.delete(chave)
        return proximo
      },
      { replace: true },
    )
  }

  function trocarVisao(nova: Visao) {
    setVisao(nova)
    atualizarParametro('ver', nova === 'semana' ? '' : nova)
  }

  function navegar(direcao: -1 | 1) {
    if (visao === 'dia') setReferencia((atual) => somarDias(atual, direcao, fuso))
    else if (visao === 'semana') setReferencia((atual) => somarDias(atual, direcao * 7, fuso))
    else setReferencia((atual) => somarMeses(atual, direcao, fuso))
  }

  function abrirCriacao(instante: Date, idCorretor?: string) {
    setEmEdicao(null)
    setLeadInicial(null)
    setInstanteInicial(instante)
    setCorretorInicial(idCorretor ?? (selecionados.length === 1 ? selecionados[0] : null))
    setModalAberto(true)
  }

  /**
   * Solta o bloco arrastado num novo horário.
   *
   * A revalidação é do banco: os triggers 4 e 5 recusam conflito e
   * horário fora da janela, e a mensagem deles já vem pronta em
   * português. Antecipar aqui só duplicaria a regra.
   */
  async function soltar(instante: Date, idCorretor?: string) {
    const visita = arrastada.current
    arrastada.current = null
    if (!visita) return

    const mesmoHorario = new Date(visita.data_hora_inicio).getTime() === instante.getTime()
    const mesmoCorretor = !idCorretor || idCorretor === visita.id_corretor
    if (mesmoHorario && mesmoCorretor) return

    try {
      await moverVisita(visita, instante, idCorretor)
      notificar.sucesso(
        'Visita reagendada',
        `${formatarDataPorExtenso(instante, fuso)}, às ${formatarHoraCurta(instante, fuso)}.`,
      )
      await carregarVisitas()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível reagendar.')
    }
  }

  async function mudarStatus(
    visita: VisitaCompleta,
    status: 'agendada' | 'realizada' | 'cancelada',
  ) {
    try {
      await mudarStatusVisita(visita, status)
      notificar.sucesso(
        status === 'cancelada'
          ? 'Visita cancelada'
          : status === 'realizada'
            ? 'Visita marcada como realizada'
            : 'Visita reaberta',
        status === 'realizada' ? 'O lead foi promovido a cliente.' : undefined,
      )
      setEmDetalhe(null)
      await carregarVisitas()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível alterar o status.')
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirVisita(paraExcluir)
      notificar.sucesso('Visita excluída')
      setParaExcluir(null)
      setEmDetalhe(null)
      await carregarVisitas()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível excluir a visita.')
    }
  }

  /* --------------------------------------------------------- render */
  const semCorretores = !carregando && corretores.length === 0
  const avisoDeFuso = fusoDoNavegador() !== fuso

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Agenda</h2>
          <p className="texto-apoio">
            Visitas em blocos de 30 minutos, na cor de cada corretor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SeletorVisao valor={visao} aoMudar={trocarVisao} />
          <Button onClick={() => abrirCriacao(proximoSlot(fuso))} disabled={semCorretores}>
            <Plus className="size-4" />
            Nova visita
          </Button>
        </div>
      </div>

      {avisoDeFuso && (
        <p className="rounded-lg border border-alerta/30 bg-alerta/8 px-3.5 py-2.5 text-sm text-texto-suave">
          Seu computador está no fuso <strong>{fusoDoNavegador()}</strong>, mas a imobiliária
          opera em <strong>{fuso}</strong>. Os horários exibidos seguem o fuso da imobiliária.
        </p>
      )}

      {/* ---------------- Navegação e filtros ---------------- */}
      <div className="cartao flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variante="secundario"
              tamanho="iconePequeno"
              onClick={() => navegar(-1)}
              aria-label="Período anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variante="secundario"
              tamanho="iconePequeno"
              onClick={() => navegar(1)}
              aria-label="Próximo período"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <h3 className="titulo-secao capitalize">{rotuloPeriodo(referencia, visao, fuso)}</h3>

          <Button
            variante="fantasma"
            tamanho="pequeno"
            onClick={() => setReferencia(new Date())}
            className="ml-auto"
          >
            Hoje
          </Button>
        </div>

        {corretores.length > 0 && (
          <div className="border-t border-borda pt-4">
            <FiltroCorretores
              corretores={corretores}
              selecionados={selecionados}
              aoAlternar={alternarCorretor}
              aoLimpar={() => atualizarParametro('corretores', '')}
              status={filtroStatus}
              aoMudarStatus={(v) => atualizarParametro('status', v)}
            />
          </div>
        )}
      </div>

      {/* ---------------- Conteúdo ---------------- */}
      {carregando ? (
        <EstadoCarregando mensagem="Carregando a agenda…" />
      ) : semCorretores ? (
        <div className="cartao">
          <EstadoVazio
            icone={BadgeCheck}
            titulo="A agenda depende de corretores"
            descricao="Nenhum corretor cadastrado ainda. Sem equipe não há janela de atendimento, e sem janela não existe horário para oferecer, nem no painel, nem para o agente de IA."
            acao={{
              rotulo: 'Ir para Corretores',
              aoClicar: () => irPara('/painel/corretores'),
            }}
          />
        </div>
      ) : visao === 'mes' ? (
        <VisaoMes
          mes={referencia}
          fuso={fuso}
          visitas={visitasVisiveis}
          aoAbrirDia={(dia) => {
            setReferencia(dia)
            trocarVisao('dia')
          }}
        />
      ) : visitasVisiveis.length === 0 && visao === 'semana' ? (
        <div className="cartao overflow-hidden">
          <EstadoVazio
            icone={CalendarOff}
            titulo="Nenhuma visita neste período"
            descricao="Clique em qualquer horário livre da agenda para marcar uma visita, ou navegue para outra semana."
            acao={{ rotulo: 'Nova visita', aoClicar: () => abrirCriacao(proximoSlot(fuso)) }}
          />
          <div className="border-t border-borda">
            <VisaoSemana
              inicioDaSemana={periodo.inicio}
              fuso={fuso}
              visitas={[]}
              corretores={corretoresVisiveis}
              minutoInicio={faixa.inicio}
              minutoFim={faixa.fim}
              recemChegadas={recemChegadas}
              aoClicarVazio={abrirCriacao}
              aoAbrirVisita={setEmDetalhe}
              aoIniciarArrasto={(v) => (arrastada.current = v)}
              aoTerminarArrasto={() => (arrastada.current = null)}
              aoSoltar={(instante) => void soltar(instante)}
            />
          </div>
        </div>
      ) : (
        <div className="cartao overflow-hidden">
          {visao === 'semana' ? (
            <VisaoSemana
              inicioDaSemana={periodo.inicio}
              fuso={fuso}
              visitas={visitasVisiveis}
              corretores={corretoresVisiveis}
              minutoInicio={faixa.inicio}
              minutoFim={faixa.fim}
              recemChegadas={recemChegadas}
              aoClicarVazio={abrirCriacao}
              aoAbrirVisita={setEmDetalhe}
              aoIniciarArrasto={(v) => (arrastada.current = v)}
              aoTerminarArrasto={() => (arrastada.current = null)}
              aoSoltar={(instante) => void soltar(instante)}
            />
          ) : (
            <VisaoDia
              dia={referencia}
              fuso={fuso}
              visitas={visitasVisiveis}
              corretores={corretoresVisiveis}
              minutoInicio={faixa.inicio}
              minutoFim={faixa.fim}
              recemChegadas={recemChegadas}
              aoClicarVazio={abrirCriacao}
              aoAbrirVisita={setEmDetalhe}
              aoIniciarArrasto={(v) => (arrastada.current = v)}
              aoTerminarArrasto={() => (arrastada.current = null)}
              aoSoltar={(instante, idCorretor) => void soltar(instante, idCorretor)}
            />
          )}
        </div>
      )}

      {!semCorretores && (
        <p className="text-xs text-texto-tenue">
          Clique num horário livre para marcar · arraste um bloco para reagendar
          {visao === 'dia' && ' ou para trocar o corretor'} ·{' '}
          <Link to="/painel/corretores" className="text-destaque hover:underline">
            ajustar janelas de atendimento
          </Link>
        </p>
      )}

      {/* ---------------- Modais ---------------- */}
      <ModalVisita
        aberto={modalAberto}
        aoFechar={() => {
          setModalAberto(false)
          setLeadInicial(null)
        }}
        fuso={fuso}
        instanteInicial={instanteInicial}
        corretorInicial={corretorInicial}
        leadInicial={leadInicial}
        visita={emEdicao}
        corretores={corretores}
        visitasDoPeriodo={visitas}
        aoSalvar={carregarVisitas}
      />

      <DetalheVisita
        visita={emDetalhe}
        fuso={fuso}
        aoFechar={() => setEmDetalhe(null)}
        aoEditar={(visita) => {
          setEmDetalhe(null)
          setEmEdicao(visita)
          setLeadInicial(null)
          setInstanteInicial(null)
          setModalAberto(true)
        }}
        aoMudarStatus={mudarStatus}
        aoExcluir={(visita) => {
          setEmDetalhe(null)
          setParaExcluir(visita)
        }}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="visita"
          nomeItem={`${paraExcluir.crm_imobiliaria?.nome ?? 'Lead'} · ${formatarData(new Date(paraExcluir.data_hora_inicio), fuso)}`}
          aviso="Excluir remove a visita do histórico por completo. Para manter o registro do que aconteceu, prefira cancelar: a visita continua visível na agenda, marcada como cancelada."
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- apoio */

function SeletorVisao({
  valor,
  aoMudar,
}: {
  valor: Visao
  aoMudar: (visao: Visao) => void
}) {
  const opcoes: { chave: Visao; rotulo: string }[] = [
    { chave: 'dia', rotulo: 'Dia' },
    { chave: 'semana', rotulo: 'Semana' },
    { chave: 'mes', rotulo: 'Mês' },
  ]

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-borda bg-superficie-alternativa p-1"
      role="group"
      aria-label="Visualização da agenda"
    >
      {opcoes.map(({ chave, rotulo }) => (
        <button
          key={chave}
          type="button"
          onClick={() => aoMudar(chave)}
          aria-pressed={valor === chave}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            valor === chave
              ? 'bg-superficie text-texto shadow-cartao'
              : 'text-texto-suave hover:text-texto',
          )}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}

function rotuloPeriodo(referencia: Date, visao: Visao, fuso: string): string {
  const p = partesNoFuso(referencia, fuso)

  if (visao === 'dia') return formatarDataPorExtenso(referencia, fuso)
  if (visao === 'mes') return `${NOMES_MESES[p.mes - 1]} de ${p.ano}`

  const inicio = inicioDaSemana(referencia, fuso)
  const fim = somarDias(inicio, 6, fuso)
  const pi = partesNoFuso(inicio, fuso)
  const pf = partesNoFuso(fim, fuso)

  if (pi.mes === pf.mes) {
    return `${pi.dia} a ${pf.dia} de ${NOMES_MESES[pi.mes - 1]}`
  }
  return `${pi.dia} de ${NOMES_MESES[pi.mes - 1]} a ${pf.dia} de ${NOMES_MESES[pf.mes - 1]}`
}

/** Próximo bloco de 30 minutos a partir de agora. */
function proximoSlot(fuso: string): Date {
  const agora = new Date()
  const p = partesNoFuso(agora, fuso)
  const minutos = p.hora * 60 + p.minuto
  const arredondado = Math.ceil(minutos / 30) * 30
  return new Date(inicioDoDia(agora, fuso).getTime() + arredondado * 60_000)
}

function formatarHoraCurta(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/**
 * Visão inicial.
 *
 * No mobile a semana em sete colunas fica ilegível, então o padrão vira
 * o dia. A escolha explícita na URL sempre vence.
 */
function visaoInicial(): Visao {
  const daUrl = new URLSearchParams(window.location.search).get('ver')
  if (daUrl === 'dia' || daUrl === 'mes' || daUrl === 'semana') return daUrl
  return window.matchMedia('(max-width: 767px)').matches ? 'dia' : 'semana'
}
