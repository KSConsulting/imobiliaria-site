import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { janelaDoDia, type CorretorCompleto } from '@/lib/corretores'
import { minutosDoDia, partesNoFuso } from '@/lib/datas'

export type Agendamento = Tabelas['agendamentos']['Row']

/** Duração fixa do bloco de visita. Ver CLAUDE.md, regras críticas. */
export const DURACAO_VISITA = 30

export interface VisitaCompleta extends Agendamento {
  crm_imobiliaria: { id: string; nome: string | null; whatsapp: string } | null
  imoveis: { id: string; codigo: string; titulo: string; bairro: string } | null
  corretores: { id: string; nome: string; sobrenome: string; cor: string } | null
}

export const ROTULOS_STATUS_VISITA: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
}

/**
 * Os mesmos status no plural, para o filtro da Agenda.
 *
 * Escritos por extenso, e não derivados do singular com um `+ 's'`: a
 * regra funcionaria para os quatro de hoje e quebraria calada no
 * primeiro status que não termine em vogal.
 */
export const ROTULOS_STATUS_VISITA_PLURAL: Record<string, string> = {
  agendada: 'Agendadas',
  realizada: 'Realizadas',
  cancelada: 'Canceladas',
  reagendada: 'Reagendadas',
}

/**
 * Valor do filtro de status que traz tudo, canceladas inclusive.
 *
 * Precisa existir porque o **padrão da Agenda é esconder as canceladas**,
 * então "sem filtro" já não significa "tudo". Sem este valor não haveria
 * como pedir a grade completa, e a diferença entre os dois estados
 * ficaria indizível pela URL.
 */
export const STATUS_TODAS = 'todas'

/**
 * Quem marcou a visita, dito na tela.
 *
 * `origem` é por visita, e é a única resposta correta para "isso foi um
 * usuário ou foi o agente?". O mesmo lead pode ter uma visita marcada
 * na conversa do WhatsApp e outra marcada por um corretor no painel.
 *
 * Antes só o caso do agente tinha selo, e o resto se lia pela ausência
 * dele. Ausência não afirma nada: quem abre a ficha não sabe se aquela
 * visita é do painel ou se o selo é que não apareceu.
 *
 * `origem` nula fica sem rótulo de propósito. Registro antigo ou vindo
 * por fora não tem como dizer quem o criou, e chutar "painel" ali seria
 * afirmar o que não se sabe.
 */
export const ROTULOS_ORIGEM_VISITA: Record<string, string> = {
  painel: 'Agendada no painel',
  agente_ia: 'Agendada pelo agente de IA',
  api: 'Agendada pela API',
}

const SELECAO =
  '*, crm_imobiliaria(id, nome, whatsapp), imoveis(id, codigo, titulo, bairro), corretores(id, nome, sobrenome, cor)'

export async function listarVisitas(inicio: Date, fim: Date): Promise<VisitaCompleta[]> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select(SELECAO)
    .gte('data_hora_inicio', inicio.toISOString())
    .lt('data_hora_inicio', fim.toISOString())
    .order('data_hora_inicio')

  if (error) throw error
  return (data ?? []) as unknown as VisitaCompleta[]
}

export async function buscarVisita(id: string): Promise<VisitaCompleta | null> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select(SELECAO)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as VisitaCompleta | null
}

export interface DadosVisita {
  id_lead: string
  id_corretor: string
  id_imovel: string | null
  data_hora_inicio: Date
  observacoes: string | null
}

/**
 * Cria a visita.
 *
 * `codigo_imovel` é copiado aqui, no momento do agendamento, e não lido
 * por junção depois. A exclusão de imóvel é definitiva: sem a cópia, o
 * histórico de uma visita a um imóvel já vendido não diria o que foi
 * visitado. Ver BANCO.md.
 *
 * Os triggers 4 e 5 validam conflito de horário e janela de atendimento,
 * e o trigger 8 move o lead para `agendou`. Nada disso é replicado aqui.
 */
export async function criarVisita(dados: DadosVisita): Promise<Agendamento> {
  const fim = new Date(dados.data_hora_inicio.getTime() + DURACAO_VISITA * 60_000)

  let codigoImovel: string | null = null
  if (dados.id_imovel) {
    const { data } = await supabase
      .from('imoveis')
      .select('codigo')
      .eq('id', dados.id_imovel)
      .maybeSingle()
    codigoImovel = data?.codigo ?? null
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .insert({
      id_lead: dados.id_lead,
      id_corretor: dados.id_corretor,
      id_imovel: dados.id_imovel,
      codigo_imovel: codigoImovel,
      data_hora_inicio: dados.data_hora_inicio.toISOString(),
      data_hora_fim: fim.toISOString(),
      observacoes: dados.observacoes,
      origem: 'painel',
    })
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.agendamentoCriado,
    tabela: 'agendamentos',
    idRegistro: data.id,
    dadosNovos: data,
  })

  return data
}

/** Reagenda ou troca o corretor. Usado pelo arrastar e pelo detalhe. */
export async function moverVisita(
  visita: VisitaCompleta,
  novoInicio: Date,
  novoCorretor?: string,
): Promise<Agendamento> {
  const fim = new Date(novoInicio.getTime() + DURACAO_VISITA * 60_000)

  const { data, error } = await supabase
    .from('agendamentos')
    .update({
      data_hora_inicio: novoInicio.toISOString(),
      data_hora_fim: fim.toISOString(),
      id_corretor: novoCorretor ?? visita.id_corretor,
    })
    .eq('id', visita.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.agendamentoAtualizado,
    tabela: 'agendamentos',
    idRegistro: visita.id,
    dadosAnteriores: {
      data_hora_inicio: visita.data_hora_inicio,
      id_corretor: visita.id_corretor,
    },
    dadosNovos: { data_hora_inicio: data.data_hora_inicio, id_corretor: data.id_corretor },
  })

  return data
}

export async function atualizarVisita(
  visita: VisitaCompleta,
  dados: Partial<DadosVisita> & { observacoes?: string | null },
): Promise<Agendamento> {
  const alteracoes: Tabelas['agendamentos']['Update'] = {}

  if (dados.id_lead) alteracoes.id_lead = dados.id_lead
  if (dados.id_corretor) alteracoes.id_corretor = dados.id_corretor
  if (dados.observacoes !== undefined) alteracoes.observacoes = dados.observacoes

  if (dados.id_imovel !== undefined) {
    alteracoes.id_imovel = dados.id_imovel
    if (dados.id_imovel) {
      const { data } = await supabase
        .from('imoveis')
        .select('codigo')
        .eq('id', dados.id_imovel)
        .maybeSingle()
      alteracoes.codigo_imovel = data?.codigo ?? null
    } else {
      alteracoes.codigo_imovel = null
    }
  }

  if (dados.data_hora_inicio) {
    alteracoes.data_hora_inicio = dados.data_hora_inicio.toISOString()
    alteracoes.data_hora_fim = new Date(
      dados.data_hora_inicio.getTime() + DURACAO_VISITA * 60_000,
    ).toISOString()
  }

  const { data, error } = await supabase
    .from('agendamentos')
    .update(alteracoes)
    .eq('id', visita.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.agendamentoAtualizado,
    tabela: 'agendamentos',
    idRegistro: visita.id,
    dadosAnteriores: visita,
    dadosNovos: data,
  })

  return data
}

/**
 * Muda o status da visita.
 *
 * O efeito no lead é do banco, não daqui. O trigger 8 decide: cancelar
 * só rebaixa o lead para `cancelou` quando não sobra nenhuma outra
 * visita agendada para ele, e `realizada` o promove a `visitou`, o que
 * por sua vez dispara o trigger 7 e o transforma em cliente.
 * Replicar essa lógica no frontend produziria duas fontes de verdade
 * que divergem no primeiro caso de borda.
 */
export async function mudarStatusVisita(
  visita: VisitaCompleta,
  status: 'agendada' | 'realizada' | 'cancelada',
): Promise<Agendamento> {
  const { data, error } = await supabase
    .from('agendamentos')
    .update({ status })
    .eq('id', visita.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: status === 'cancelada' ? Acoes.agendamentoCancelado : Acoes.agendamentoAtualizado,
    tabela: 'agendamentos',
    idRegistro: visita.id,
    dadosAnteriores: { status: visita.status },
    dadosNovos: { status, codigo_imovel: visita.codigo_imovel },
  })

  return data
}

export async function excluirVisita(visita: VisitaCompleta): Promise<void> {
  await registrarLog({
    acao: Acoes.agendamentoCancelado,
    tabela: 'agendamentos',
    idRegistro: visita.id,
    dadosAnteriores: visita,
  })

  const { error } = await supabase.from('agendamentos').delete().eq('id', visita.id)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Busca de lead e imóvel para o modal                                 */
/* ------------------------------------------------------------------ */

export interface LeadResumo {
  id: string
  nome: string | null
  whatsapp: string
  status: string
}

export async function buscarLeads(termo: string): Promise<LeadResumo[]> {
  const limpo = termo.replace(/[,()%\\]/g, ' ').trim()

  let consulta = supabase
    .from('crm_imobiliaria')
    .select('id, nome, whatsapp, status')
    .order('created_at', { ascending: false })
    .limit(12)

  if (limpo) consulta = consulta.or(`nome.ilike.%${limpo}%,whatsapp.ilike.%${limpo}%`)

  const { data, error } = await consulta
  if (error) throw error
  return data ?? []
}

/**
 * Lead pelo id, no formato reduzido que o modal de visita usa.
 *
 * Serve à ficha do lead, que manda agendar em `/painel/agenda?lead=…`:
 * a Agenda recebe só o id na URL e precisa do registro para abrir o
 * modal já preenchido.
 */
export async function buscarLeadResumo(id: string): Promise<LeadResumo | null> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .select('id, nome, whatsapp, status')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Cria um lead a partir do modal de visita.
 *
 * Usa upsert por `whatsapp`, que é a chave natural — o mesmo caminho do
 * agente de IA. Se o número já existe, aproveita o lead em vez de
 * estourar um erro de duplicidade na cara de quem só queria marcar uma
 * visita. Ver CLAUDE.md, regras críticas.
 */
export async function criarLeadRapido(whatsapp: string, nome: string): Promise<LeadResumo> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .upsert(
      { whatsapp: whatsapp.replace(/\D/g, ''), nome: nome.trim() || null, origem: 'painel' },
      { onConflict: 'whatsapp' },
    )
    .select('id, nome, whatsapp, status')
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.leadCriado,
    tabela: 'crm_imobiliaria',
    idRegistro: data.id,
    dadosNovos: data,
  })

  return data
}

export interface ImovelResumo {
  id: string
  codigo: string
  titulo: string
  bairro: string
  cidade: string
}

export async function buscarImoveisParaVisita(termo: string): Promise<ImovelResumo[]> {
  const limpo = termo.replace(/[,()%\\]/g, ' ').trim()

  let consulta = supabase
    .from('imoveis')
    .select('id, codigo, titulo, bairro, cidade')
    .order('created_at', { ascending: false })
    .limit(12)

  if (limpo) {
    consulta = consulta.or(
      `codigo.ilike.%${limpo}%,titulo.ilike.%${limpo}%,bairro.ilike.%${limpo}%`,
    )
  }

  const { data, error } = await consulta
  if (error) throw error
  return data ?? []
}

/* ------------------------------------------------------------------ */
/* Disponibilidade antecipada                                          */
/* ------------------------------------------------------------------ */

export type MotivoIndisponivel = 'fora-da-janela' | 'ocupado' | null

/**
 * Prevê o que os triggers 4 e 5 responderiam, sem tentar salvar.
 *
 * Serve para mostrar o problema no momento em que o usuário escolhe o
 * corretor, e não depois de preencher o modal inteiro e apertar salvar.
 * **Não substitui a validação do banco**, que continua sendo a fonte de
 * verdade — entre o cálculo aqui e o insert existe uma janela em que o
 * agente de IA pode ter ocupado o horário.
 */
export function verificarDisponibilidade(
  corretor: CorretorCompleto,
  inicio: Date,
  fuso: string,
  visitasExistentes: VisitaCompleta[],
  idVisitaIgnorada?: string,
): MotivoIndisponivel {
  const partes = partesNoFuso(inicio, fuso)
  const janela = janelaDoDia(corretor, partes.diaSemana)

  const minutoInicio = minutosDoDia(inicio, fuso)
  const minutoFim = minutoInicio + DURACAO_VISITA

  if (!janela || minutoInicio < janela.inicio || minutoFim > janela.fim) {
    return 'fora-da-janela'
  }

  const fim = new Date(inicio.getTime() + DURACAO_VISITA * 60_000)
  const conflito = visitasExistentes.some((visita) => {
    if (visita.id === idVisitaIgnorada) return false
    if (visita.id_corretor !== corretor.id) return false
    if (visita.status !== 'agendada' && visita.status !== 'realizada') return false

    const vi = new Date(visita.data_hora_inicio).getTime()
    const vf = new Date(visita.data_hora_fim).getTime()
    return vi < fim.getTime() && vf > inicio.getTime()
  })

  return conflito ? 'ocupado' : null
}

export const MENSAGENS_INDISPONIVEL: Record<Exclude<MotivoIndisponivel, null>, string> = {
  'fora-da-janela': 'Fora da janela de atendimento deste corretor',
  ocupado: 'Já tem visita nesse horário',
}
