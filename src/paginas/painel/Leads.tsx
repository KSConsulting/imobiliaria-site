import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, SearchX, Users } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AlternadorLeadsFunil } from '@/componentes/AlternadorLeadsFunil'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { EsqueletoTabela } from '@/componentes/EstadoCarregando'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { BarraFiltrosLead } from '@/componentes/leads/BarraFiltrosLead'
import { ModalLead } from '@/componentes/leads/ModalLead'
import { PainelLead } from '@/componentes/leads/PainelLead'
import { TabelaLeads } from '@/componentes/leads/TabelaLeads'
import { usarFiltrosLead, usarOrdenacaoLead } from '@/ganchos/usarFiltrosLead'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import {
  contarLeads,
  contarVisitasDoLead,
  excluirLead,
  LIMITE_LISTAGEM,
  listarLeads,
  listarOrigens,
  nomeExibido,
  temFiltroLeadAtivo,
  type Lead,
  type LeadComImovel,
} from '@/lib/leads'
import { FUSO_PADRAO } from '@/lib/datas'
import { notificar } from '@/lib/notificacoes'

export function Leads() {
  const { configuracoes } = usarConfiguracoes()
  const fuso = configuracoes?.fuso_horario ?? FUSO_PADRAO

  const { filtros, definirFiltro, alternarStatus, limparFiltros } = usarFiltrosLead()
  const { ordenacao, ordenarPor } = usarOrdenacaoLead()

  const [leads, setLeads] = useState<LeadComImovel[]>([])
  const [origens, setOrigens] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [totalCadastrado, setTotalCadastrado] = useState(0)

  const [idAberto, setIdAberto] = useState<string | null>(null)
  const [emEdicao, setEmEdicao] = useState<Lead | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Lead | null>(null)
  const [visitasDoExcluir, setVisitasDoExcluir] = useState(0)

  const filtroAtivo = useMemo(() => temFiltroLeadAtivo(filtros), [filtros])

  const carregar = useCallback(async () => {
    try {
      setLeads(await listarLeads(filtros, ordenacao))
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os leads.')
    } finally {
      setCarregando(false)
    }
  }, [filtros, ordenacao])

  // Debounce só na busca por texto; os demais filtros aplicam na hora.
  useEffect(() => {
    const atraso = filtros.busca ? 300 : 0
    const tempo = setTimeout(() => void carregar(), atraso)
    return () => clearTimeout(tempo)
  }, [carregar, filtros.busca])

  const recontarTotal = useCallback(async () => {
    try {
      setTotalCadastrado(await contarLeads())
    } catch {
      /* silencioso: só alimenta a escolha do estado vazio */
    }
  }, [])

  const recarregarOrigens = useCallback(async () => {
    try {
      setOrigens(await listarOrigens())
    } catch (erro) {
      console.warn('[leads] falha ao carregar origens:', erro)
    }
  }, [])

  useEffect(() => {
    void recontarTotal()
    void recarregarOrigens()
  }, [recontarTotal, recarregarOrigens])

  function abrirCriacao() {
    setEmEdicao(null)
    setModalAberto(true)
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
      await Promise.all([carregar(), recontarTotal()])
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível excluir o lead.')
    }
  }

  const noLimite = leads.length >= LIMITE_LISTAGEM

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Leads</h2>
          <p className="texto-apoio">
            Todos os contatos da imobiliária, em lista. O agente de IA escreve aqui em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AlternadorLeadsFunil />
          <Button onClick={abrirCriacao}>
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
      />

      {!carregando && leads.length > 0 && (
        <p className="-mb-2 text-sm text-texto-suave">
          {leads.length === 1 ? '1 lead encontrado' : `${leads.length} leads encontrados`}
          {filtroAtivo && totalCadastrado > 0 && (
            <span className="text-texto-tenue"> de {totalCadastrado} cadastrados</span>
          )}
          {/* Teto atingido é dito em voz alta: uma lista truncada em
              silêncio parece completa, e a decisão tomada em cima dela
              seria tomada com meia base. */}
          {noLimite && (
            <span className="text-alerta">
              {' '}
              · exibindo os {LIMITE_LISTAGEM} primeiros. Use os filtros para estreitar a busca.
            </span>
          )}
        </p>
      )}

      {/* ---------------- Conteúdo ---------------- */}
      {carregando ? (
        <div className="cartao p-4">
          <EsqueletoTabela linhas={8} colunas={5} />
        </div>
      ) : leads.length === 0 ? (
        <div className="cartao">
          {filtroAtivo ? (
            <EstadoVazio
              icone={SearchX}
              titulo="Nenhum lead para esses filtros"
              descricao="Nenhum dos contatos cadastrados corresponde à combinação aplicada. Tente afrouxar algum critério."
              acao={{ rotulo: 'Limpar filtros', aoClicar: limparFiltros }}
            />
          ) : (
            <EstadoVazio
              icone={Users}
              titulo="Nenhum lead cadastrado"
              descricao="Os leads chegam sozinhos assim que o agente de IA entrar no ar, porque ele cria o contato pelo WhatsApp. Enquanto isso, dá para cadastrar à mão quem ligar."
              acao={{ rotulo: 'Cadastrar primeiro lead', aoClicar: abrirCriacao }}
            />
          )}
        </div>
      ) : (
        <TabelaLeads
          leads={leads}
          fuso={fuso}
          ordenacao={ordenacao}
          ordenarPor={ordenarPor}
          aoAbrir={(lead) => setIdAberto(lead.id)}
          aoEditar={abrirEdicao}
          aoExcluir={(lead) => void abrirExclusao(lead)}
        />
      )}

      {/* ---------------- Ficha e modais ---------------- */}
      <PainelLead
        idLead={idAberto}
        aoFechar={() => setIdAberto(null)}
        fuso={fuso}
        aoAtualizar={() => void carregar()}
        aoEditar={abrirEdicao}
        aoExcluir={(lead) => void abrirExclusao(lead)}
      />

      <ModalLead
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        lead={emEdicao}
        aoSalvar={() => {
          void carregar()
          void recontarTotal()
          void recarregarOrigens()
        }}
        aoAbrirExistente={setIdAberto}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="lead"
          nomeItem={nomeExibido(paraExcluir)}
          aviso={montarAviso(visitasDoExcluir)}
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}

/**
 * Aviso da exclusão de lead.
 *
 * As visitas são a consequência que ninguém espera: a FK
 * `agendamentos.id_lead` é ON DELETE CASCADE, então excluir o lead
 * apaga também as visitas dele — inclusive as futuras, que simplesmente
 * somem da agenda do corretor sem nenhum aviso do outro lado.
 */
function montarAviso(visitas: number): string {
  const partes = [
    'O contato sai do CRM e o histórico da conversa com o agente de IA vai junto.',
  ]

  if (visitas > 0) {
    partes.push(
      visitas === 1
        ? 'A visita ligada a este lead também será excluída e desaparecerá da agenda do corretor.'
        : `As ${visitas} visitas ligadas a este lead também serão excluídas e desaparecerão da agenda dos corretores.`,
    )
  }

  partes.push(
    'Se a pessoa voltar a chamar no WhatsApp, o agente criará um lead novo, sem o histórico anterior.',
  )
  return partes.join(' ')
}
