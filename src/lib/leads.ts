import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { exibirWhatsapp, paraLinkWhatsapp } from '@/lib/telefone'

export type Lead = Tabelas['crm_imobiliaria']['Row']

/**
 * Colunas que o job de relógio reescreve, e só ele.
 *
 * `minutos_ultima_mensagem` é envelhecido de minuto em minuto por
 * `fn_atualizar_minutos_ultima_mensagem` (migration `…024`), para o
 * agente de IA ler o número real direto da tabela. `updated_at` vem
 * junto porque o trigger o carimba em todo UPDATE.
 */
const COLUNAS_DO_RELOGIO = new Set(['minutos_ultima_mensagem', 'updated_at'])

/**
 * O evento do Realtime é só o relógio andando?
 *
 * Sem esta pergunta, o Funil aberto recarregaria uma coluna por lead, a
 * cada minuto, para sempre. E o estrago não seria a consulta: recarregar
 * a coluna a joga de volta na primeira página, então quem tivesse
 * clicado em "carregar mais" perderia o que abriu, sozinho, a cada
 * minuto — sem nada ter acontecido com lead nenhum.
 *
 * A comparação só é possível porque `crm_imobiliaria` está em `replica
 * identity full`: com a identidade padrão, `payload.old` traria apenas a
 * chave primária e não haveria o que comparar.
 */
export function soMudouORelogio(
  anterior: Record<string, unknown> | null,
  novo: Record<string, unknown> | null,
): boolean {
  if (!anterior || !novo) return false

  let mudouOutraCoisa = false
  for (const chave of Object.keys(novo)) {
    if (COLUNAS_DO_RELOGIO.has(chave)) continue
    if (anterior[chave] !== novo[chave]) {
      mudouOutraCoisa = true
      break
    }
  }

  return !mudouOutraCoisa
}

/* ==================================================================== */
/* Etapas do funil                                                       */
/* ==================================================================== */

export type StatusLead =
  | 'novo'
  | 'conversando'
  | 'agendou'
  | 'visitou'
  | 'cancelou'
  | 'follow_up_1'
  | 'follow_up_2'

export interface EtapaFunil {
  chave: StatusLead
  rotulo: string
  /** Frase curta exibida na coluna vazia do Kanban. */
  vazio: string
  /**
   * Classes do sistema de design, escritas por extenso.
   *
   * Montar `bg-status-${chave}` não funcionaria: o Tailwind lê o código
   * como texto e só gera as classes que encontra escritas. A cor sairia
   * sem estilo nenhum, e só em produção.
   */
  badge: string
  barra: string
  ponto: string
}

/**
 * As sete etapas, na ordem das colunas do Kanban.
 *
 * A ordem é a do percurso do lead, não a da constraint do banco — que é
 * apenas um conjunto de valores aceitos, sem sequência.
 *
 * `cancelou` fica entre `visitou` e os follow ups de propósito: é de lá
 * que o lead sai para o follow up, e ter as três colunas vizinhas é o
 * que torna esse movimento um arrasto curto em vez de uma travessia.
 *
 * **Estes valores são do nicho imobiliário.** Ver REPLICACAO.md antes de
 * levar o sistema para outro negócio: mudam aqui, nas cores do
 * `index.css`, na constraint `crm_imobiliaria_status_valido` e no
 * trigger 8, que é quem escreve `agendou`, `visitou` e `cancelou`.
 */
export const ETAPAS_FUNIL: EtapaFunil[] = [
  {
    chave: 'novo',
    rotulo: 'Novo',
    vazio: 'Nenhum contato novo aguardando.',
    badge: 'bg-status-novo/12 text-status-novo',
    barra: 'bg-status-novo',
    ponto: 'bg-status-novo',
  },
  {
    chave: 'conversando',
    rotulo: 'Conversando',
    vazio: 'Nenhuma conversa em andamento.',
    badge: 'bg-status-conversando/12 text-status-conversando',
    barra: 'bg-status-conversando',
    ponto: 'bg-status-conversando',
  },
  {
    chave: 'agendou',
    rotulo: 'Agendou',
    vazio: 'Ninguém com visita marcada.',
    badge: 'bg-status-agendou/12 text-status-agendou',
    barra: 'bg-status-agendou',
    ponto: 'bg-status-agendou',
  },
  {
    chave: 'visitou',
    rotulo: 'Visitou',
    vazio: 'Nenhuma visita realizada ainda.',
    badge: 'bg-status-visitou/12 text-status-visitou',
    barra: 'bg-status-visitou',
    ponto: 'bg-status-visitou',
  },
  {
    chave: 'cancelou',
    rotulo: 'Cancelou',
    vazio: 'Nenhum cancelamento.',
    badge: 'bg-status-cancelou/12 text-status-cancelou',
    barra: 'bg-status-cancelou',
    ponto: 'bg-status-cancelou',
  },
  {
    chave: 'follow_up_1',
    rotulo: 'Follow up 1',
    vazio: 'Nenhum lead na primeira retomada.',
    badge: 'bg-status-follow-up-1/12 text-status-follow-up-1',
    barra: 'bg-status-follow-up-1',
    ponto: 'bg-status-follow-up-1',
  },
  {
    chave: 'follow_up_2',
    rotulo: 'Follow up 2',
    vazio: 'Nenhum lead na segunda retomada.',
    badge: 'bg-status-follow-up-2/12 text-status-follow-up-2',
    barra: 'bg-status-follow-up-2',
    ponto: 'bg-status-follow-up-2',
  },
]

const POR_CHAVE = new Map(ETAPAS_FUNIL.map((etapa) => [etapa.chave, etapa]))

/** Etapa correspondente ao status. Nunca devolve indefinido. */
export function etapaDoStatus(status: string): EtapaFunil {
  return POR_CHAVE.get(status as StatusLead) ?? ETAPAS_FUNIL[0]
}

export const ROTULOS_TIPO_LEAD: Record<string, string> = {
  lead: 'Lead',
  cliente: 'Cliente',
}

/* ==================================================================== */
/* Filtros                                                               */
/* ==================================================================== */

export interface FiltrosLead {
  /** Nome, WhatsApp ou código do imóvel de interesse. */
  busca: string
  /** Múltipla seleção, separada por vírgula na URL. */
  status: string
  origem: string
  /** `lead` ou `cliente`. */
  tipo: string
  finalidade: string
  /** Entrada a partir de (AAAA-MM-DD). */
  de: string
  /** Entrada até (AAAA-MM-DD), inclusive. */
  ate: string
}

export const FILTROS_LEAD_VAZIOS: FiltrosLead = {
  busca: '',
  status: '',
  origem: '',
  tipo: '',
  finalidade: '',
  de: '',
  ate: '',
}

export function temFiltroLeadAtivo(filtros: FiltrosLead): boolean {
  return Object.values(filtros).some((valor) => valor !== '')
}

/** Os filtros que a barra do Funil não exibe — as colunas já são o status. */
export function statusSelecionados(filtros: FiltrosLead): StatusLead[] {
  return filtros.status
    .split(',')
    .map((valor) => valor.trim())
    .filter((valor): valor is StatusLead => POR_CHAVE.has(valor as StatusLead))
}

/** Escapa o termo para o operador `.or()` do PostgREST. Ver lib/imoveis.ts. */
function limparTermo(termo: string): string {
  return termo.replace(/[,()%\\]/g, ' ').trim()
}

export type ColunaOrdenacao = 'nome' | 'status' | 'origem' | 'ultima_mensagem' | 'created_at'

export interface Ordenacao {
  coluna: ColunaOrdenacao
  ascendente: boolean
}

export const ORDENACAO_PADRAO: Ordenacao = { coluna: 'created_at', ascendente: false }

/* ==================================================================== */
/* Consulta                                                              */
/* ==================================================================== */

const COLUNAS = '*'

/**
 * Teto da listagem de Leads.
 *
 * A tela não é paginada: o uso real é filtrar e agir, não folhear. O
 * teto existe para que uma base grande não derrube o navegador, e a
 * página avisa quando ele é atingido — truncar em silêncio faria a lista
 * parecer completa quando não é.
 */
export const LIMITE_LISTAGEM = 500

function consultaBase(opcoes?: { count: 'exact' }) {
  return supabase.from('crm_imobiliaria').select(COLUNAS, opcoes)
}

type ConstrutorLeads = ReturnType<typeof consultaBase>

/** Aplica os filtros comuns às duas telas. */
function aplicarFiltros(consulta: ConstrutorLeads, filtros: FiltrosLead): ConstrutorLeads {
  let q = consulta

  const termo = limparTermo(filtros.busca)
  if (termo) {
    q = q.or(
      [
        `nome.ilike.%${termo}%`,
        `whatsapp.ilike.%${termo}%`,
        `codigo_imovel_interesse.ilike.%${termo}%`,
      ].join(','),
    )
  }

  const status = statusSelecionados(filtros)
  if (status.length > 0) q = q.in('status', status)

  if (filtros.origem) q = q.eq('origem', filtros.origem)
  if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
  if (filtros.finalidade) q = q.eq('finalidade_interesse', filtros.finalidade)

  // O período é escolhido em dia de calendário; `created_at` é instante.
  // O limite superior é o dia seguinte às 00:00, senão "até 10/08" não
  // traz nada que tenha entrado ao longo do dia 10.
  if (filtros.de) q = q.gte('created_at', `${filtros.de}T00:00:00`)
  if (filtros.ate) q = q.lt('created_at', `${filtros.ate}T23:59:59.999`)

  return q
}

export interface LeadComImovel extends Lead {
  /**
   * Imóvel correspondente a `codigo_imovel_interesse`.
   *
   * `null` quando o código existe mas o imóvel não está mais cadastrado
   * — a exclusão de imóvel é definitiva e o código do lead sobrevive a
   * ela. Distinguir os dois casos é o que evita link quebrado na ficha.
   */
  imovel_interesse: { id: string; codigo: string; titulo: string } | null
}

/**
 * Resolve `codigo_imovel_interesse` em uma consulta só.
 *
 * Não existe chave estrangeira entre `crm_imobiliaria` e `imoveis`: o
 * lead guarda o código como texto, de propósito, para sobreviver à
 * exclusão do imóvel. Sem FK não há junção do PostgREST, então a
 * resolução é feita aqui — em lote, e não uma consulta por linha.
 */
async function anexarImoveis(leads: Lead[]): Promise<LeadComImovel[]> {
  const codigos = [
    ...new Set(leads.map((lead) => lead.codigo_imovel_interesse).filter((c): c is string => !!c)),
  ]

  const mapa = new Map<string, { id: string; codigo: string; titulo: string }>()

  if (codigos.length > 0) {
    const { data, error } = await supabase
      .from('imoveis')
      .select('id, codigo, titulo')
      .in('codigo', codigos)

    if (error) {
      // Falhar aqui não pode derrubar a listagem inteira: o lead vale
      // mesmo sem o imóvel resolvido.
      console.warn('[leads] falha ao resolver imóveis de interesse:', error.message)
    } else {
      for (const imovel of data ?? []) mapa.set(imovel.codigo, imovel)
    }
  }

  return leads.map((lead) => ({
    ...lead,
    imovel_interesse: lead.codigo_imovel_interesse
      ? (mapa.get(lead.codigo_imovel_interesse) ?? null)
      : null,
  }))
}

/** Listagem da página de Leads. */
export async function listarLeads(
  filtros: FiltrosLead,
  ordenacao: Ordenacao = ORDENACAO_PADRAO,
): Promise<LeadComImovel[]> {
  let consulta = aplicarFiltros(consultaBase(), filtros).limit(LIMITE_LISTAGEM)

  // `nullsFirst: false` joga quem não tem nome ou nunca mandou mensagem
  // para o fim, nas duas direções. Uma tela que abre com dez linhas
  // vazias no topo parece quebrada.
  consulta = consulta.order(ordenacao.coluna, {
    ascending: ordenacao.ascendente,
    nullsFirst: false,
  })

  // Desempate estável: sem ele, dois leads com o mesmo status trocam de
  // lugar a cada recarga e a lista parece embaralhar sozinha.
  if (ordenacao.coluna !== 'created_at') {
    consulta = consulta.order('created_at', { ascending: false })
  }

  const { data, error } = await consulta
  if (error) throw error

  return anexarImoveis(data ?? [])
}

/** Total de leads cadastrados, sem filtro. Distingue os dois vazios. */
export async function contarLeads(): Promise<number> {
  const { count, error } = await supabase
    .from('crm_imobiliaria')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

/** Quantidade de cards carregados por vez em cada coluna do Kanban. */
export const PAGINA_FUNIL = 15

/**
 * Uma página de uma coluna do Kanban.
 *
 * `total` é a contagem real da coluna inteira, não do que veio nesta
 * página: o cabeçalho precisa dizer quantos leads existem naquela etapa,
 * independentemente de quantos cards já foram carregados. `count:
 * 'exact'` combinado com `range` devolve os dois na mesma viagem.
 */
export async function listarColunaFunil(
  status: StatusLead,
  filtros: FiltrosLead,
  deslocamento = 0,
  limite = PAGINA_FUNIL,
): Promise<{ leads: LeadComImovel[]; total: number }> {
  // O status da coluna vence o filtro de status: no Funil o filtro
  // escolhe quais colunas aparecem, não quem entra em cada uma.
  const consulta = aplicarFiltros(consultaBase({ count: 'exact' }), { ...filtros, status: '' })

  const { data, error, count } = await consulta
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(deslocamento, deslocamento + limite - 1)

  if (error) throw error

  return { leads: await anexarImoveis(data ?? []), total: count ?? 0 }
}

export async function buscarLead(id: string): Promise<LeadComImovel | null> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const [comImovel] = await anexarImoveis([data])
  return comImovel
}

/** O que o agente de IA registrou da conversa, sem o resto da ficha. */
export type AtendimentoDoAgente = Pick<
  Lead,
  'motivo_contato' | 'resumo_conversa' | 'inicio_atendimento' | 'ultima_mensagem'
>

/**
 * Busca só o que o agente gravou da conversa de um lead.
 *
 * Existe separado de `buscarLead` por causa de onde é usado: o detalhe
 * da visita precisa de quatro campos, e `buscarLead` traz a ficha
 * inteira mais uma segunda consulta para resolver o imóvel de interesse.
 *
 * E não entra na seleção de `listarVisitas`: `resumo_conversa` é texto
 * corrido, e carregá-lo para cada bloco da semana baixaria dezenas de
 * resumos para exibir, no máximo, um. Aqui a leitura acontece quando o
 * detalhe abre, e só quando a visita veio do agente.
 */
export async function buscarAtendimentoDoLead(
  id: string,
): Promise<AtendimentoDoAgente | null> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .select('motivo_contato, resumo_conversa, inicio_atendimento, ultima_mensagem')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Origens já registradas, para alimentar o filtro. */
export async function listarOrigens(): Promise<string[]> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .select('origem')
    .not('origem', 'is', null)

  if (error) throw error

  const origens = new Set<string>()
  for (const linha of data ?? []) {
    if (linha.origem) origens.add(linha.origem)
  }
  return [...origens].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/* ==================================================================== */
/* Escrita                                                               */
/* ==================================================================== */

export interface DadosLead {
  whatsapp: string
  nome: string | null
  email: string | null
  origem: string | null
  finalidade_interesse: string | null
  tipo_imovel_interesse: string | null
  faixa_valor_min: number | null
  faixa_valor_max: number | null
  observacoes: string | null
}

/**
 * Erro de violação da UNIQUE de `whatsapp`.
 *
 * O código 23505 é `unique_violation` do Postgres. Vale para qualquer
 * índice único da tabela, mas `whatsapp` é o único que existe em
 * `crm_imobiliaria` além da chave primária, que é gerada pelo banco.
 */
export function ehErroDeDuplicidade(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === '23505'
}

/** Busca pelo número já normalizado, para detectar duplicidade. */
export async function buscarLeadPorWhatsapp(whatsapp: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .select(COLUNAS)
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Cadastro manual de lead.
 *
 * Insert, não upsert — ao contrário do cadastro rápido dentro do modal
 * de visita. A diferença é de intenção: lá o usuário quer marcar uma
 * visita e o lead é meio de caminho, então aproveitar o registro
 * existente em silêncio é o comportamento certo. Aqui ele está
 * cadastrando alguém, e sobrescrever um lead que já tem histórico com os
 * campos em branco de um formulário novo seria perda de dado.
 *
 * Quando o número já existe, quem chama trata o 23505 oferecendo abrir o
 * cadastro existente. Ver `ehErroDeDuplicidade`.
 */
export async function criarLead(dados: DadosLead): Promise<Lead> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .insert({ ...dados, whatsapp: dados.whatsapp.replace(/\D/g, '') })
    .select()
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

export async function atualizarLead(lead: Lead, dados: DadosLead): Promise<Lead> {
  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .update({ ...dados, whatsapp: dados.whatsapp.replace(/\D/g, '') })
    .eq('id', lead.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.leadAtualizado,
    tabela: 'crm_imobiliaria',
    idRegistro: lead.id,
    dadosAnteriores: lead,
    dadosNovos: data,
  })

  return data
}

/** Salva só as observações, direto da ficha. */
export async function salvarObservacoes(lead: Lead, observacoes: string): Promise<Lead> {
  const texto = observacoes.trim() || null

  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .update({ observacoes: texto })
    .eq('id', lead.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.leadAtualizado,
    tabela: 'crm_imobiliaria',
    idRegistro: lead.id,
    dadosAnteriores: { observacoes: lead.observacoes },
    dadosNovos: { observacoes: texto },
  })

  return data
}

/**
 * Move o lead de etapa.
 *
 * **A releitura ao final não é redundante.** Mover para `visitou`
 * dispara o trigger 7, que promove o lead a cliente em um segundo
 * UPDATE. O `RETURNING` do primeiro update devolve a linha como ela
 * ficou antes desse segundo — ou seja, ainda com `tipo = 'lead'`. Sem a
 * releitura, o card voltaria para a tela dizendo "Lead" logo depois de
 * ter virado cliente, e só uma recarga manual mostraria a verdade.
 *
 * A regra em si é do banco. Aqui só se reflete o resultado.
 */
export async function mudarStatusLead(lead: Lead, status: StatusLead): Promise<Lead> {
  const { error } = await supabase
    .from('crm_imobiliaria')
    .update({ status })
    .eq('id', lead.id)

  if (error) throw error

  const { data, error: erroLeitura } = await supabase
    .from('crm_imobiliaria')
    .select(COLUNAS)
    .eq('id', lead.id)
    .single()

  if (erroLeitura) throw erroLeitura

  await registrarLog({
    acao: Acoes.leadAtualizado,
    tabela: 'crm_imobiliaria',
    idRegistro: lead.id,
    dadosAnteriores: { status: lead.status, tipo: lead.tipo },
    dadosNovos: { status: data.status, tipo: data.tipo },
  })

  return data
}

/** Quantas visitas existem para este lead. Alimenta o aviso da exclusão. */
export async function contarVisitasDoLead(idLead: string): Promise<number> {
  const { count, error } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('id_lead', idLead)

  if (error) {
    console.warn('[leads] falha ao contar visitas:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Exclui o lead.
 *
 * A FK `agendamentos.id_lead` é ON DELETE CASCADE: as visitas do lead
 * saem junto, inclusive as futuras, que somem da agenda do corretor sem
 * deixar rastro. É por isso que o modal conta as visitas antes e diz o
 * número — e por isso o log guarda o registro completo antes do delete.
 */
export async function excluirLead(lead: Lead): Promise<void> {
  await registrarLog({
    acao: Acoes.leadExcluido,
    tabela: 'crm_imobiliaria',
    idRegistro: lead.id,
    dadosAnteriores: lead,
  })

  const { error } = await supabase.from('crm_imobiliaria').delete().eq('id', lead.id)
  if (error) throw error
}

/* ==================================================================== */
/* Visitas do lead                                                       */
/* ==================================================================== */

export interface VisitaDoLead {
  id: string
  data_hora_inicio: string
  data_hora_fim: string
  status: string
  codigo_imovel: string | null
  observacoes: string | null
  imoveis: { id: string; codigo: string; titulo: string } | null
  corretores: { nome: string; sobrenome: string; cor: string } | null
}

export async function listarVisitasDoLead(idLead: string): Promise<VisitaDoLead[]> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select(
      'id, data_hora_inicio, data_hora_fim, status, codigo_imovel, observacoes, imoveis(id, codigo, titulo), corretores(nome, sobrenome, cor)',
    )
    .eq('id_lead', idLead)
    .order('data_hora_inicio', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as VisitaDoLead[]
}

/*
 * O painel não exibe nada do Chatwoot.
 *
 * As colunas `id_conta_chatwoot`, `id_conversa_chatwoot`,
 * `id_lead_chatwoot` e `inbox_id_chatwoot` continuam em
 * `crm_imobiliaria` e continuam sendo gravadas pelo N8N — elas são do
 * atendimento, não da interface. O que saiu foi o botão que levava à
 * conversa e a variável `VITE_CHATWOOT_BASE_URL` que o montava.
 *
 * Antes de recriar isso: o que tornava o botão frágil não era o link, era
 * depender de uma configuração de implantação que ninguém preenche. Sem
 * ela o botão sumia, e explicar a ausência exigia expor o nome de uma
 * variável de ambiente na ficha que o corretor usa todo dia.
 */

/* ==================================================================== */
/* Apresentação                                                          */
/* ==================================================================== */

/**
 * Como o lead deve ser chamado na tela.
 *
 * O agente de IA cria o lead a partir do número antes de saber o nome,
 * então lead sem nome é o caso comum, não a exceção. Cair para o
 * WhatsApp mantém a linha identificável; um espaço em branco tornaria a
 * lista impossível de ler.
 */
export function nomeExibido(lead: Pick<Lead, 'nome' | 'whatsapp'>): string {
  const nome = lead.nome?.trim()
  return nome ? nome : formatarWhatsapp(lead.whatsapp)
}

/**
 * (11) 98765-4321 no Brasil, +351 912 345 678 fora.
 *
 * A regra de país mora em `src/lib/telefone.ts`, junto com o seletor do
 * formulário. Duas cópias divergiriam no primeiro país novo.
 */
export function formatarWhatsapp(numero: string): string {
  return exibirWhatsapp(numero)
}

/** Link direto para a conversa no WhatsApp. */
export function linkWhatsapp(numero: string): string {
  return `https://wa.me/${paraLinkWhatsapp(numero)}`
}

/**
 * Interesse do lead resumido em uma linha.
 *
 * Junta finalidade, tipo e faixa de valor no que existir. Quatro colunas
 * separadas para isso deixariam a tabela larga e quase toda vazia — o
 * agente preenche o que a conversa der.
 */
export function resumirInteresse(lead: Lead, formatar: (v: number) => string): string {
  const partes: string[] = []

  if (lead.finalidade_interesse) {
    partes.push(lead.finalidade_interesse === 'venda' ? 'Compra' : 'Locação')
  }
  if (lead.tipo_imovel_interesse) partes.push(lead.tipo_imovel_interesse)

  const { faixa_valor_min: min, faixa_valor_max: max } = lead
  if (min !== null && max !== null) partes.push(`${formatar(min)} a ${formatar(max)}`)
  else if (min !== null) partes.push(`a partir de ${formatar(min)}`)
  else if (max !== null) partes.push(`até ${formatar(max)}`)

  return partes.join(' · ')
}
