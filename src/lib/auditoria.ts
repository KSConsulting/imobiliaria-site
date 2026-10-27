import { supabase } from '@/lib/supabase'
import { instanteDe } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'

/**
 * Leitura da trilha de auditoria.
 *
 * `src/lib/logs.ts` é o lado da escrita e continua sendo a única porta
 * de entrada de `logs_sistema`. Este arquivo é o lado da leitura: nada
 * aqui grava nada, e a tela de Logs não oferece nenhuma ação de
 * alteração. O banco também não permitiria — a tabela tem política de
 * select e de insert, e nenhuma de update ou delete (ver BANCO.md).
 */

export interface LinhaLog {
  id: string
  created_at: string
  acao: string
  categoria: string
  tabela: string | null
  id_registro: string | null
  dados_anteriores: unknown
  dados_novos: unknown
  id_usuario: string | null
  usuario_nome: string | null
  usuario_email: string | null
  total: number
}

export interface FiltrosLog {
  busca: string
  categoria: string
  tabela: string
  usuario: string
  /** yyyy-mm-dd, inclusivo. */
  de: string
  /** yyyy-mm-dd, inclusivo — convertido para fim exclusivo na consulta. */
  ate: string
}

export const FILTROS_VAZIOS: FiltrosLog = {
  busca: '',
  categoria: '',
  tabela: '',
  usuario: '',
  de: '',
  ate: '',
}

export const TAMANHO_PAGINA_LOGS = 25

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */

/**
 * As mesmas chaves devolvidas por `fn_log_categoria` no banco.
 *
 * A classificação é do Postgres, não daqui — se cada lado tivesse a
 * própria regra, filtrar por "exclusão" traria uma lista que o rótulo da
 * linha contradiz. Aqui ficam só os rótulos e as cores.
 */
export const CATEGORIAS_LOG: Record<string, { rotulo: string; classe: string }> = {
  api: { rotulo: 'Consulta da API', classe: 'bg-status-agendou/12 text-status-agendou' },
  criacao: { rotulo: 'Criação', classe: 'bg-status-visitou/12 text-status-visitou' },
  edicao: { rotulo: 'Edição', classe: 'bg-status-conversando/12 text-status-conversando' },
  exclusao: { rotulo: 'Exclusão', classe: 'bg-destrutivo/12 text-destrutivo' },
  status: { rotulo: 'Ativação e desativação', classe: 'bg-status-follow-up-1/15 text-status-follow-up-2' },
  sessao: { rotulo: 'Acesso ao sistema', classe: 'bg-superficie-alternativa text-texto-suave' },
  outro: { rotulo: 'Outras', classe: 'bg-superficie-alternativa text-texto-suave' },
}

export function rotuloCategoria(chave: string): string {
  return CATEGORIAS_LOG[chave]?.rotulo ?? 'Outras'
}

/** Nome legível da tabela, para o filtro e para a coluna. */
export const ROTULOS_TABELA: Record<string, string> = {
  imoveis: 'Imóveis',
  imoveis_fotos: 'Fotos de imóvel',
  crm_imobiliaria: 'Leads',
  corretores: 'Corretores',
  agendas: 'Agendas',
  agendas_horarios: 'Janelas de atendimento',
  agendamentos: 'Visitas',
  tipos_imovel: 'Tipos de imóvel',
  api_tokens: 'Tokens da API',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
}

export function rotuloTabela(tabela: string | null): string {
  if (!tabela) return '—'
  return ROTULOS_TABELA[tabela] ?? tabela
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export interface PaginaLogs {
  linhas: LinhaLog[]
  total: number
}

export async function listarLogs(
  filtros: FiltrosLog,
  pagina: number,
  fuso: string,
): Promise<PaginaLogs> {
  const { data, error } = await supabase.rpc('fn_logs_listar', {
    p_busca: filtros.busca.trim() || undefined,
    p_categoria: filtros.categoria || undefined,
    p_tabela: filtros.tabela || undefined,
    p_usuario: filtros.usuario || undefined,
    p_inicio: limiteInicial(filtros.de, fuso),
    p_fim: limiteFinal(filtros.ate, fuso),
    p_limite: TAMANHO_PAGINA_LOGS,
    p_deslocamento: pagina * TAMANHO_PAGINA_LOGS,
  })

  if (error) throw error

  const linhas = (data ?? []) as unknown as LinhaLog[]
  // O total vem repetido em todas as linhas, por window function. Numa
  // página vazia não vem nenhuma — e aí o total é zero mesmo.
  return { linhas, total: linhas[0]?.total ?? 0 }
}

/**
 * O dia digitado vira instante no fuso da imobiliária, não em UTC.
 *
 * Filtrar "10/08" em UTC incluiria as ações da noite de 09/08 em São
 * Paulo e cortaria as três últimas horas do próprio dia 10 — o usuário
 * procuraria a exclusão que fez ontem à noite e ela apareceria na data
 * errada, ou não apareceria.
 */
function limiteInicial(dia: string, fuso: string): string | undefined {
  if (!dia) return undefined
  const [ano, mes, d] = dia.split('-').map(Number)
  return instanteDe(ano, mes, d, 0, 0, fuso).toISOString()
}

/** `ate` é o último dia desejado; o fim exclusivo é o dia seguinte. */
function limiteFinal(dia: string, fuso: string): string | undefined {
  if (!dia) return undefined
  const [ano, mes, d] = dia.split('-').map(Number)
  return instanteDe(ano, mes, d + 1, 0, 0, fuso).toISOString()
}

export interface OpcoesFiltroLog {
  tabelas: string[]
  categorias: string[]
  usuarios: { id: string; nome: string }[]
}

export async function buscarOpcoesFiltro(): Promise<OpcoesFiltroLog> {
  const { data, error } = await supabase.rpc('fn_logs_filtros')
  if (error) throw error

  const linha = (data ?? [])[0] as
    | { tabelas: string[] | null; categorias: string[] | null; usuarios: unknown }
    | undefined

  return {
    tabelas: linha?.tabelas ?? [],
    categorias: linha?.categorias ?? [],
    usuarios: (linha?.usuarios as { id: string; nome: string }[] | null) ?? [],
  }
}

/* ------------------------------------------------------------------ */
/* Linguagem natural                                                   */
/* ------------------------------------------------------------------ */

interface Descritor {
  /** Frase quando há assunto identificável. `%s` é o assunto. */
  com: string
  /** Frase quando não há — registro antigo, ou payload sem nome. */
  sem: string
}

/**
 * Como cada ação é contada em português.
 *
 * "Excluiu o imóvel IMV-0042" e "delete imoveis" descrevem o mesmo
 * evento, mas só a primeira é lida por quem precisa auditar. A segunda
 * exige que o leitor saiba o nome das tabelas — o que exclui exatamente
 * a pessoa que mais consulta esta tela, que é a dona da imobiliária.
 */
const DESCRITORES: Record<string, Descritor> = {
  imovel_criado: { com: 'Cadastrou o imóvel %s', sem: 'Cadastrou um imóvel' },
  imovel_atualizado: { com: 'Editou o imóvel %s', sem: 'Editou um imóvel' },
  imovel_excluido: { com: 'Excluiu o imóvel %s', sem: 'Excluiu um imóvel' },
  imovel_ativado: { com: 'Reativou o imóvel %s', sem: 'Reativou um imóvel' },
  imovel_desativado: { com: 'Desativou o imóvel %s', sem: 'Desativou um imóvel' },
  foto_adicionada: { com: 'Adicionou foto ao imóvel %s', sem: 'Adicionou uma foto de imóvel' },
  foto_removida: { com: 'Removeu foto do imóvel %s', sem: 'Removeu uma foto de imóvel' },

  lead_criado: { com: 'Cadastrou o lead %s', sem: 'Cadastrou um lead' },
  lead_atualizado: { com: 'Atualizou o lead %s', sem: 'Atualizou um lead' },
  lead_excluido: { com: 'Excluiu o lead %s', sem: 'Excluiu um lead' },

  corretor_criado: { com: 'Cadastrou o corretor %s', sem: 'Cadastrou um corretor' },
  corretor_atualizado: { com: 'Atualizou o corretor %s', sem: 'Atualizou um corretor' },
  corretor_excluido: { com: 'Excluiu o corretor %s', sem: 'Excluiu um corretor' },

  agendamento_criado: { com: 'Agendou uma visita para %s', sem: 'Agendou uma visita' },
  agendamento_atualizado: { com: 'Alterou a visita de %s', sem: 'Alterou uma visita' },
  agendamento_cancelado: { com: 'Cancelou a visita de %s', sem: 'Cancelou uma visita' },

  tipo_imovel_criado: { com: 'Criou o tipo de imóvel %s', sem: 'Criou um tipo de imóvel' },
  tipo_imovel_atualizado: { com: 'Renomeou o tipo de imóvel para %s', sem: 'Renomeou um tipo de imóvel' },
  tipo_imovel_ativado: { com: 'Reativou o tipo de imóvel %s', sem: 'Reativou um tipo de imóvel' },
  tipo_imovel_desativado: { com: 'Desativou o tipo de imóvel %s', sem: 'Desativou um tipo de imóvel' },
  tipo_imovel_excluido: { com: 'Excluiu o tipo de imóvel %s', sem: 'Excluiu um tipo de imóvel' },
  tipos_imovel_reordenados: {
    com: 'Reordenou os tipos de imóvel',
    sem: 'Reordenou os tipos de imóvel',
  },

  token_criado: { com: 'Criou o token da API "%s"', sem: 'Criou um token da API' },
  token_revogado: { com: 'Revogou o token da API "%s"', sem: 'Revogou um token da API' },
  token_reativado: { com: 'Reativou o token da API "%s"', sem: 'Reativou um token da API' },
  token_excluido: { com: 'Excluiu o token da API "%s"', sem: 'Excluiu um token da API' },

  configuracoes_atualizadas: {
    com: 'Atualizou os dados da imobiliária',
    sem: 'Atualizou os dados da imobiliária',
  },

  login_realizado: { com: 'Entrou no sistema', sem: 'Entrou no sistema' },
  logout_realizado: { com: 'Saiu do sistema', sem: 'Saiu do sistema' },

  // Consultas da API. As ESCRITAS feitas pela API não aparecem aqui de
  // propósito: elas usam os mesmos nomes de ação do painel, para que uma
  // visita marcada pelo agente e uma marcada pela recepção apareçam lado
  // a lado na mesma linha do tempo. Quem as diferencia é o consumidor.
  api_imovel_consultado: { com: 'Consultou o imóvel %s', sem: 'Consultou um imóvel' },
  api_imoveis_buscados: {
    com: 'Buscou imóveis por características',
    sem: 'Buscou imóveis por características',
  },
  api_imoveis_listados: { com: 'Listou os imóveis', sem: 'Listou os imóveis' },
  api_disponibilidade_consultada: {
    com: 'Consultou horários disponíveis',
    sem: 'Consultou horários disponíveis',
  },
  api_visitas_consultadas: { com: 'Consultou as visitas', sem: 'Consultou as visitas' },
  api_corretores_consultados: { com: 'Consultou os corretores', sem: 'Consultou os corretores' },
  api_lead_consultado: { com: 'Consultou o contato %s', sem: 'Consultou um contato' },
  // O endpoint GET /imobiliaria foi removido, mas o rótulo fica. Toda
  // chamada que ele recebeu enquanto existiu está gravada em
  // `logs_sistema`, que não tem política de update nem de delete: o que
  // entrou ali não sai mais. Apagar o rótulo não apagaria as linhas,
  // só as deixaria sem tradução na aba de Logs.
  api_imobiliaria_consultada: {
    com: 'Consultou os dados da imobiliária',
    sem: 'Consultou os dados da imobiliária',
  },
}

/**
 * Quem executou a ação.
 *
 * Chamada da API não tem usuário do painel do outro lado, e `id_usuario`
 * fica nulo. Exibir "Sistema" nesse caso esconde a informação que mais
 * importa quando o volume passa a ser do agente: **qual consumidor**. O
 * nome dele viaja em `dados_novos.consumidor`, gravado pela Edge
 * Function.
 */
export function autorDoLog(log: LinhaLog): { nome: string; viaApi: boolean } {
  const dados = log.dados_novos
  if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
    const consumidor = (dados as Record<string, unknown>).consumidor
    if (typeof consumidor === 'string' && consumidor.trim()) {
      return { nome: consumidor, viaApi: true }
    }
  }
  return { nome: log.usuario_nome ?? 'Sistema', viaApi: false }
}

/** A frase que aparece na coluna "Ação". */
export function descreverAcao(log: LinhaLog): string {
  const assunto = assuntoDoLog(log)
  const descritor = DESCRITORES[log.acao]

  if (!descritor) {
    // Ação nova que ainda não ganhou frase. Melhor um texto legível do
    // que a chave crua — e melhor ainda que apareça, porque é assim que
    // se descobre que faltou cadastrar a frase.
    const legivel = log.acao.replace(/_/g, ' ')
    const frase = legivel.charAt(0).toUpperCase() + legivel.slice(1)
    return assunto ? `${frase}: ${assunto}` : frase
  }

  return assunto ? descritor.com.replace('%s', assunto) : descritor.sem
}

/**
 * O que o log é "sobre".
 *
 * Olha primeiro o estado novo e depois o anterior, nessa ordem: numa
 * edição interessa o valor que ficou, e numa exclusão só existe o
 * anterior. Os campos são tentados do mais identificável para o menos —
 * código de imóvel antes de título, nome antes de WhatsApp.
 */
function assuntoDoLog(log: LinhaLog): string | null {
  for (const fonte of [log.dados_novos, log.dados_anteriores]) {
    const objeto = comoObjeto(fonte)
    if (!objeto) continue

    const codigo = texto(objeto.codigo)
    if (codigo) return codigo

    const negocio = texto(objeto.nome_negocio)
    if (negocio) return negocio

    const nome = texto(objeto.nome)
    if (nome) {
      const sobrenome = texto(objeto.sobrenome)
      return sobrenome ? `${nome} ${sobrenome}` : nome
    }

    const titulo = texto(objeto.titulo)
    if (titulo) return titulo

    const whatsapp = texto(objeto.whatsapp)
    if (whatsapp) return whatsapp
  }
  return null
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/* ------------------------------------------------------------------ */
/* Detalhe: campos, rótulos e diferenças                               */
/* ------------------------------------------------------------------ */

/**
 * Campos que mudam sozinhos a cada gravação.
 *
 * Deixá-los no comparativo faria toda edição parecer ter alterado três
 * campos a mais, e o `updated_at` apareceria em destaque em cima do
 * campo que de fato interessa.
 */
const CAMPOS_IGNORADOS = new Set(['id', 'created_at', 'updated_at'])

const ROTULOS_CAMPO: Record<string, string> = {
  // imóveis
  codigo: 'Código',
  titulo: 'Título',
  descricao: 'Descrição',
  id_tipo_imovel: 'Tipo de imóvel',
  finalidade: 'Finalidade',
  status: 'Status',
  valor_venda: 'Valor de venda',
  valor_aluguel: 'Valor do aluguel',
  valor_condominio: 'Condomínio',
  valor_iptu: 'IPTU',
  quartos: 'Quartos',
  suites: 'Suítes',
  banheiros: 'Banheiros',
  vagas: 'Vagas',
  area_total: 'Área total',
  area_util: 'Área útil',
  mobiliado: 'Mobiliado',
  aceita_pet: 'Aceita pet',
  diferenciais: 'Diferenciais',
  destaque: 'Em destaque',
  proprietario_nome: 'Proprietário',
  proprietario_contato: 'Contato do proprietário',
  observacoes_internas: 'Observações internas',
  total_visualizacoes: 'Visualizações acumuladas',
  total_cliques_whatsapp: 'Cliques no WhatsApp',
  // endereço
  cep: 'CEP',
  endereco: 'Endereço',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  estado: 'Estado',
  // pessoas
  nome: 'Nome',
  sobrenome: 'Sobrenome',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  telefone: 'Telefone',
  creci: 'CRECI',
  cor: 'Cor na agenda',
  ativo: 'Ativo',
  // leads
  origem: 'Origem',
  tipo_lead: 'Tipo de lead',
  observacoes: 'Observações',
  imovel_interesse: 'Imóvel de interesse',
  ultima_mensagem: 'Última mensagem',
  resumo_conversa: 'Resumo da conversa',
  // agenda
  data_hora_inicio: 'Início',
  data_hora_fim: 'Fim',
  id_corretor: 'Corretor',
  id_imovel: 'Imóvel',
  id_lead: 'Lead',
  // configurações e tipos
  nome_negocio: 'Nome da imobiliária',
  logo_url: 'Logo',
  foto_hero_url: 'Foto de fundo do site',
  site: 'Site',
  instagram: 'Instagram',
  link_google_maps: 'Google Maps',
  fuso_horario: 'Fuso horário',
  ordem: 'Ordem',
  token: 'Token',
  ultimo_uso: 'Último uso',
  // Gravados pela Edge Function em toda ação vinda da API. `origem` já
  // tem rótulo acima, vindo dos leads — o significado é o mesmo.
  consumidor: 'Consumidor da API',
  filtros: 'Filtros usados',
  encontrados: 'Resultados',
}

export function rotuloCampo(campo: string): string {
  if (ROTULOS_CAMPO[campo]) return ROTULOS_CAMPO[campo]
  const legivel = campo.replace(/_/g, ' ')
  return legivel.charAt(0).toUpperCase() + legivel.slice(1)
}

const CAMPOS_MONETARIOS = new Set([
  'valor_venda',
  'valor_aluguel',
  'valor_condominio',
  'valor_iptu',
])

/** Valor pronto para leitura. `null` vira travessão, não "null". */
export function formatarValorCampo(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'number') {
    return CAMPOS_MONETARIOS.has(campo) ? formatarMoeda(valor) : String(valor)
  }
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '—'
  if (typeof valor === 'object') return JSON.stringify(valor)

  const texto = String(valor)
  // Datas ISO ficam ilegíveis cruas dentro de uma tabela de diferenças.
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    const data = new Date(texto)
    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    }
  }
  return texto
}

export interface DiferencaCampo {
  campo: string
  rotulo: string
  antes: unknown
  depois: unknown
  mudou: boolean
}

/**
 * Compara os dois estados campo a campo.
 *
 * Devolve a união das chaves dos dois lados, não só as que mudaram: numa
 * exclusão existe apenas o anterior, e é o registro inteiro que precisa
 * aparecer — depois que o imóvel sai do banco, este é o único lugar onde
 * ele ainda existe.
 */
export function compararEstados(anterior: unknown, novo: unknown): DiferencaCampo[] {
  const antes = comoObjeto(anterior) ?? {}
  const depois = comoObjeto(novo) ?? {}

  const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter((chave) => !CAMPOS_IGNORADOS.has(chave))
    .sort((a, b) => rotuloCampo(a).localeCompare(rotuloCampo(b), 'pt-BR'))

  return chaves.map((campo) => ({
    campo,
    rotulo: rotuloCampo(campo),
    antes: antes[campo] ?? null,
    depois: depois[campo] ?? null,
    mudou: JSON.stringify(antes[campo] ?? null) !== JSON.stringify(depois[campo] ?? null),
  }))
}

/** Quantos campos de fato mudaram. Usado no resumo do painel de detalhe. */
export function contarAlteracoes(diferencas: DiferencaCampo[]): number {
  return diferencas.filter((d) => d.mudou).length
}
