import { supabase } from '@/lib/supabase'

/**
 * Consultas da vitrine.
 *
 * Este arquivo é o único caminho pelo qual o site público lê o banco, e
 * existe separado de `lib/imoveis.ts` por dois motivos que não são de
 * organização:
 *
 * 1. **Nenhuma consulta daqui usa `select('*')`.** As colunas são
 *    listadas uma a uma. Ver `CAMPOS_CARD` e `CAMPOS_DETALHE`.
 * 2. **Toda consulta filtra `status = 'ativo'` explicitamente**, mesmo
 *    havendo RLS. Ver `somenteAtivos`.
 *
 * As duas regras estão explicadas nas constantes correspondentes. Quem
 * adicionar consulta nova aqui precisa manter as duas.
 */

/* ==================================================================== */
/* Colunas expostas ao público                                           */
/* ==================================================================== */

/**
 * Colunas do cartão da listagem.
 *
 * **A lista é explícita porque o RLS não protege coluna, só linha.** A
 * política `imoveis_anon_leitura_ativos` libera a linha inteira do
 * imóvel ativo para o visitante anônimo — inclusive `proprietario_nome`
 * e `proprietario_contato`. Um `select('*')` aqui entregaria o telefone
 * do dono do imóvel para qualquer um que abrisse a aba de rede do
 * navegador, sem nada aparecer na tela.
 *
 * Também ficam de fora, de propósito, as colunas de endereço exato
 * (`cep`, `endereco`, `numero`, `complemento`): o site mostra bairro,
 * cidade e estado, e o que não é buscado não pode vazar. Ver CLAUDE.md,
 * "O endereço exato não vai para a vitrine".
 */
const CAMPOS_CARD = `
  id, codigo, titulo, finalidade,
  valor_venda, valor_aluguel,
  bairro, cidade, estado,
  quartos, banheiros, vagas, area_total, area_util,
  created_at,
  tipos_imovel ( nome ),
  imoveis_fotos ( url, ordem, capa )
`

/** Colunas da página do imóvel. Mesmas regras de `CAMPOS_CARD`. */
const CAMPOS_DETALHE = `
  id, codigo, titulo, descricao, finalidade, id_tipo_imovel,
  valor_venda, valor_aluguel, valor_condominio, valor_iptu,
  bairro, cidade, estado,
  quartos, suites, banheiros, vagas, area_total, area_util,
  mobiliado, aceita_pet, caracteristicas,
  created_at,
  tipos_imovel ( nome ),
  imoveis_fotos ( id, url, ordem, capa )
`

export interface FotoPublica {
  id?: string
  url: string
  ordem: number
  capa: boolean
}

export interface ImovelVitrine {
  id: string
  codigo: string
  titulo: string
  finalidade: string
  valor_venda: number | null
  valor_aluguel: number | null
  bairro: string
  cidade: string
  estado: string
  quartos: number
  banheiros: number
  vagas: number
  area_total: number | null
  area_util: number | null
  created_at: string
  tipos_imovel: { nome: string } | null
  imoveis_fotos: FotoPublica[]
}

export interface ImovelDetalhe extends ImovelVitrine {
  descricao: string | null
  id_tipo_imovel: string
  valor_condominio: number | null
  valor_iptu: number | null
  suites: number
  mobiliado: boolean
  aceita_pet: boolean
  caracteristicas: unknown
}

/* ==================================================================== */
/* Filtros                                                               */
/* ==================================================================== */

export type OrdemVitrine = 'recentes' | 'menor-valor' | 'maior-valor'

export interface FiltrosVitrine {
  finalidade: string
  tipo: string
  cidade: string
  bairro: string
  valorMin: string
  valorMax: string
  quartos: string
  banheiros: string
  vagas: string
  ordem: string
}

export const FILTROS_VITRINE_VAZIOS: FiltrosVitrine = {
  finalidade: '',
  tipo: '',
  cidade: '',
  bairro: '',
  valorMin: '',
  valorMax: '',
  quartos: '',
  banheiros: '',
  vagas: '',
  ordem: '',
}

/** A ordenação não conta como filtro para o botão de limpar. */
export function temFiltroVitrineAtivo(filtros: FiltrosVitrine): boolean {
  return Object.entries(filtros).some(([chave, valor]) => chave !== 'ordem' && valor !== '')
}

/** Quantos imóveis a listagem traz por vez. */
export const PAGINA_VITRINE = 12

/* ==================================================================== */
/* Consultas                                                             */
/* ==================================================================== */

function consultaDeCards(opcoes?: { count: 'exact' }) {
  return supabase.from('imoveis').select(CAMPOS_CARD, opcoes)
}

type Construtor = ReturnType<typeof consultaDeCards>

/**
 * Restringe a consulta a imóveis ativos.
 *
 * **Não é redundância com o RLS.** A política só vale para o papel
 * `anon`. O operador que abre o site pelo link "Ver site" do painel está
 * autenticado, e para `authenticated` a política é `using (true)` — sem
 * este filtro ele veria na vitrine os imóveis que acabou de desativar,
 * concluiria que a desativação não funciona e desativaria de novo.
 *
 * Como o site é a vitrine para o cliente final, a regra "só ativos" tem
 * de valer para qualquer visitante, autenticado ou não.
 */
function somenteAtivos<T extends { eq: (coluna: string, valor: string) => T }>(consulta: T): T {
  return consulta.eq('status', 'ativo')
}

function aplicarFiltros(consulta: Construtor, filtros: FiltrosVitrine): Construtor {
  let q = consulta

  // Um imóvel de finalidade `ambos` está à venda E para alugar: precisa
  // aparecer nos dois recortes, senão some justamente o imóvel mais
  // flexível da carteira.
  if (filtros.finalidade === 'venda') q = q.in('finalidade', ['venda', 'ambos'])
  if (filtros.finalidade === 'locacao') q = q.in('finalidade', ['locacao', 'ambos'])

  if (filtros.tipo) q = q.eq('id_tipo_imovel', filtros.tipo)
  if (filtros.cidade) q = q.ilike('cidade', filtros.cidade)
  if (filtros.bairro) q = q.ilike('bairro', filtros.bairro)
  if (filtros.quartos) q = q.gte('quartos', Number(filtros.quartos))
  if (filtros.banheiros) q = q.gte('banheiros', Number(filtros.banheiros))
  if (filtros.vagas) q = q.gte('vagas', Number(filtros.vagas))

  // A faixa de valor incide sobre a coluna correspondente à finalidade
  // escolhida. Sem finalidade, compara com o valor de venda — ver
  // `colunaDeValor`.
  const coluna = colunaDeValor(filtros.finalidade)
  if (filtros.valorMin) q = q.gte(coluna, Number(filtros.valorMin))
  if (filtros.valorMax) q = q.lte(coluna, Number(filtros.valorMax))

  return q
}

/**
 * Qual coluna de valor usar para filtrar e ordenar.
 *
 * Sem finalidade escolhida, cai para `valor_venda`. Não existe resposta
 * boa aqui: comparar R$ 450.000 de venda com R$ 2.500 de aluguel na
 * mesma ordenação não significa nada. É por isso que a interface trata
 * comprar/alugar como primeiro nível de navegação, e não como mais um
 * filtro — a escolha da finalidade é o que dá sentido ao preço.
 */
function colunaDeValor(finalidade: string): 'valor_venda' | 'valor_aluguel' {
  return finalidade === 'locacao' ? 'valor_aluguel' : 'valor_venda'
}

function aplicarOrdem(consulta: Construtor, filtros: FiltrosVitrine): Construtor {
  const coluna = colunaDeValor(filtros.finalidade)

  if (filtros.ordem === 'menor-valor') {
    return consulta.order(coluna, { ascending: true, nullsFirst: false })
  }
  if (filtros.ordem === 'maior-valor') {
    return consulta.order(coluna, { ascending: false, nullsFirst: false })
  }
  return consulta.order('created_at', { ascending: false })
}

export interface PaginaVitrine {
  imoveis: ImovelVitrine[]
  /** Total real de imóveis que atendem aos filtros, não o da página. */
  total: number
}

export async function listarImoveisVitrine(
  filtros: FiltrosVitrine,
  deslocamento = 0,
  limite = PAGINA_VITRINE,
): Promise<PaginaVitrine> {
  const base = consultaDeCards({ count: 'exact' })

  const { data, error, count } = await aplicarOrdem(
    aplicarFiltros(somenteAtivos(base), filtros),
    filtros,
  ).range(deslocamento, deslocamento + limite - 1)

  if (error) throw error
  return { imoveis: (data ?? []) as unknown as ImovelVitrine[], total: count ?? 0 }
}

/** Imóveis em destaque da home: os ativos mais recentes. */
export async function listarDestaques(limite = 6, idTipo?: string | null): Promise<ImovelVitrine[]> {
  let consulta = somenteAtivos(consultaDeCards())

  // O tipo filtra no banco, e não na lista já baixada. Filtrar em memória
  // sobre os 24 mais recentes mostraria 2 chácaras a quem escolheu
  // "Chácara" numa carteira que tem 10: a categoria pareceria quase
  // vazia, e o número no próprio botão diria o contrário.
  if (idTipo) consulta = consulta.eq('id_tipo_imovel', idTipo)

  const { data, error } = await consulta.order('created_at', { ascending: false }).limit(limite)

  if (error) throw error
  return (data ?? []) as unknown as ImovelVitrine[]
}

/**
 * Busca o imóvel pelo código, e não pelo id.
 *
 * O código é o que circula: está no link do WhatsApp, na conversa com o
 * agente de IA e na boca da equipe. Um uuid na URL não diria nada a
 * ninguém e não poderia ser digitado.
 *
 * Devolve `null` quando o código não corresponde a nenhum imóvel ativo —
 * o que inclui o imóvel excluído e o desativado. Quem chama exibe a 404
 * da vitrine, que trata esse caso como o que ele é: um link antigo, não
 * um erro do visitante.
 */
export async function buscarImovelPorCodigo(codigo: string): Promise<ImovelDetalhe | null> {
  const { data, error } = await somenteAtivos(supabase.from('imoveis').select(CAMPOS_DETALHE))
    .eq('codigo', codigo.toUpperCase().trim())
    .maybeSingle()

  if (error) throw error
  return data as unknown as ImovelDetalhe | null
}

/**
 * Imóveis semelhantes ao exibido.
 *
 * Mesmo tipo e faixa de valor próxima (60% a 160% do valor de
 * referência). A faixa é larga de propósito: apertada demais, o bloco
 * vem vazio na maior parte das carteiras, e um bloco vazio no fim da
 * página é pior do que sugestão imperfeita.
 *
 * Quando o imóvel não tem valor de referência, cai para o mesmo tipo na
 * mesma cidade.
 */
export async function listarSemelhantes(
  imovel: ImovelDetalhe,
  limite = 4,
): Promise<ImovelVitrine[]> {
  const referencia =
    imovel.finalidade === 'locacao'
      ? (imovel.valor_aluguel ?? imovel.valor_venda)
      : (imovel.valor_venda ?? imovel.valor_aluguel)

  const coluna = imovel.finalidade === 'locacao' ? 'valor_aluguel' : 'valor_venda'

  let consulta = somenteAtivos(consultaDeCards())
    .eq('id_tipo_imovel', imovel.id_tipo_imovel)
    .neq('id', imovel.id)

  if (referencia !== null) {
    consulta = consulta.gte(coluna, referencia * 0.6).lte(coluna, referencia * 1.6)
  } else {
    consulta = consulta.ilike('cidade', imovel.cidade)
  }

  const { data, error } = await consulta.limit(limite)
  if (error) {
    console.warn('[vitrine] falha ao buscar semelhantes:', error.message)
    return []
  }
  return (data ?? []) as unknown as ImovelVitrine[]
}

export interface TipoVitrine {
  id: string
  nome: string
}

export async function listarTiposVitrine(): Promise<TipoVitrine[]> {
  const { data, error } = await supabase
    .from('tipos_imovel')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')

  if (error) throw error
  return data ?? []
}

export interface TipoComEstoque extends TipoVitrine {
  /** Quantos imóveis ativos existem neste tipo. */
  total: number
}

/**
 * Os tipos que **têm imóvel publicado agora**, com a contagem.
 *
 * Diferente de `listarTiposVitrine`, que devolve todo tipo ativo no
 * cadastro. A distinção existe porque os dois alimentam coisas
 * diferentes: lá é um campo de busca, onde o tipo sem estoque ainda faz
 * sentido como opção; aqui é um botão que promete resultado, e categoria
 * que abre vazia é pior do que categoria que não aparece.
 *
 * A contagem é feita sobre as linhas ativas, no cliente. **Não é o mesmo
 * caso do Dashboard**, onde a agregação vive no banco: lá a tabela é
 * `visualizacoes_site`, que cresce com o tráfego; aqui é a carteira de
 * imóveis, que tem o tamanho de um estoque de imobiliária. É o mesmo
 * caminho de `listarLocalidadesVitrine`, logo abaixo.
 */
export async function listarTiposComEstoque(): Promise<TipoComEstoque[]> {
  const [tipos, { data, error }] = await Promise.all([
    listarTiposVitrine(),
    somenteAtivos(supabase.from('imoveis').select('id_tipo_imovel')),
  ])

  if (error) throw error

  const contagem = new Map<string, number>()
  for (const linha of data ?? []) {
    if (!linha.id_tipo_imovel) continue
    contagem.set(linha.id_tipo_imovel, (contagem.get(linha.id_tipo_imovel) ?? 0) + 1)
  }

  return tipos
    .map((tipo) => ({ ...tipo, total: contagem.get(tipo.id) ?? 0 }))
    .filter((tipo) => tipo.total > 0)
}

/** Cidades e bairros com imóvel ativo, para alimentar os filtros. */
export async function listarLocalidadesVitrine(): Promise<{
  cidades: string[]
  bairros: string[]
}> {
  const { data, error } = await somenteAtivos(supabase.from('imoveis').select('cidade, bairro'))
  if (error) throw error

  const cidades = new Set<string>()
  const bairros = new Set<string>()
  for (const linha of data ?? []) {
    if (linha.cidade) cidades.add(linha.cidade)
    if (linha.bairro) bairros.add(linha.bairro)
  }

  const ordenar = (a: string, b: string) => a.localeCompare(b, 'pt-BR')
  return { cidades: [...cidades].sort(ordenar), bairros: [...bairros].sort(ordenar) }
}

/**
 * Números reais da carteira, para a faixa da home.
 *
 * Vem do banco justamente para que a faixa não possa exibir número
 * inventado. Imobiliária recém-implantada não tem histórico, e "mais de
 * 500 famílias atendidas" no ar desde o primeiro dia destrói a confiança
 * exatamente onde ela deveria ser construída. Quando os valores não
 * chegam a ser relevantes, a home não renderiza a faixa.
 */
export async function resumirVitrine(): Promise<{
  imoveis: number
  cidades: number
  paraVenda: number
  paraLocacao: number
}> {
  const { data, error } = await somenteAtivos(
    supabase.from('imoveis').select('cidade, finalidade'),
  )
  if (error) throw error

  const linhas = data ?? []
  const cidades = new Set(linhas.map((l) => l.cidade).filter(Boolean))

  return {
    imoveis: linhas.length,
    cidades: cidades.size,
    paraVenda: linhas.filter((l) => l.finalidade === 'venda' || l.finalidade === 'ambos').length,
    paraLocacao: linhas.filter((l) => l.finalidade === 'locacao' || l.finalidade === 'ambos')
      .length,
  }
}

/* ==================================================================== */
/* Fotos                                                                 */
/* ==================================================================== */

/**
 * Larguras servidas por contexto, em pixels.
 *
 * A foto sai do painel com até 1920px de largura (a compressão da Etapa
 * 3). Servir esse arquivo dentro de um cartão de 400px joga fora a maior
 * parte dos bytes baixados — e quem paga essa conta é o visitante no
 * 4G, que é de onde vem quase todo o tráfego da vitrine.
 */
export const LARGURAS_FOTO = {
  miniatura: 200,
  cartao: 800,
  principal: 1600,
} as const

const MARCADOR_OBJETO = '/storage/v1/object/public/'
const MARCADOR_RENDER = '/storage/v1/render/image/public/'

/**
 * URL da foto redimensionada pelo Storage.
 *
 * Troca o endpoint `object` pelo `render/image`, que redimensiona e
 * recomprime sob demanda, com cache do lado do Supabase.
 *
 * **Devolve a URL original sem tocar em nada quando ela não é do
 * Storage do projeto.** É o que mantém funcionando a foto colada à mão
 * nas Configurações, apontando para qualquer lugar da internet.
 *
 * Se o projeto não tiver a transformação disponível, o `<img>` recebe
 * erro e `FotoProgressiva` recarrega a original sozinho — ver o
 * tratamento de erro lá. A vitrine nunca fica sem foto por causa disto.
 */
export function urlDaFoto(url: string, largura?: number, qualidade = 72): string {
  if (!largura || !url.includes(MARCADOR_OBJETO)) return url

  const caminho = url.split(MARCADOR_OBJETO)[1]
  const base = url.split(MARCADOR_OBJETO)[0]

  return `${base}${MARCADOR_RENDER}${caminho}?width=${largura}&quality=${qualidade}&resize=contain`
}

/* ==================================================================== */
/* Apresentação                                                          */
/* ==================================================================== */

/** Foto de capa: a marcada como capa ou, na ausência, a primeira da ordem. */
export function capaDoImovel(imovel: {
  imoveis_fotos?: FotoPublica[] | null
}): string | null {
  const fotos = imovel.imoveis_fotos ?? []
  if (fotos.length === 0) return null
  return (fotos.find((foto) => foto.capa) ?? [...fotos].sort((a, b) => a.ordem - b.ordem)[0]).url
}

/** Fotos na ordem de exibição, capa primeiro. */
export function fotosOrdenadas(imovel: { imoveis_fotos?: FotoPublica[] | null }): FotoPublica[] {
  const fotos = [...(imovel.imoveis_fotos ?? [])]
  return fotos.sort((a, b) => {
    if (a.capa !== b.capa) return a.capa ? -1 : 1
    return a.ordem - b.ordem
  })
}

/** `['Piscina', 'Churrasqueira']` a partir do jsonb `caracteristicas`. */
export function diferenciaisDoImovel(caracteristicas: unknown): string[] {
  if (!Array.isArray(caracteristicas)) return []
  return caracteristicas.filter((item): item is string => typeof item === 'string' && !!item.trim())
}

export const ROTULOS_FINALIDADE_VITRINE: Record<string, string> = {
  venda: 'Venda',
  locacao: 'Locação',
}

/** Quais badges de finalidade o imóvel exibe. `ambos` exibe os dois. */
export function badgesDeFinalidade(finalidade: string): ('venda' | 'locacao')[] {
  if (finalidade === 'ambos') return ['venda', 'locacao']
  if (finalidade === 'locacao') return ['locacao']
  return ['venda']
}
