import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { LIMITE_BUSCA_MAXIMO, LIMITE_BUSCA_PADRAO } from '../_compartilhado/ambiente.ts'
import { erro, sucesso } from '../_compartilhado/respostas.ts'
import {
  CAMPOS_COMPLETO,
  CAMPOS_RESUMO,
  fichaCompleta,
  fichaResumida,
  fraseDoImovel,
  listaDeImoveis,
  moeda,
  normalizarCodigo,
} from '../_compartilhado/imoveis.ts'
import { urlDoSite } from '../_compartilhado/configuracoes.ts'
import { listar } from '../_compartilhado/datas.ts'
import { casa, listaDeTermos, normalizar } from '../_compartilhado/texto.ts'
import { AcoesApi, registrar } from '../_compartilhado/registro.ts'
import type { Consumidor } from '../_compartilhado/autenticacao.ts'

/* ------------------------------------------------------------------ */
/* GET /imoveis/codigo/:codigo                                         */
/* ------------------------------------------------------------------ */

/**
 * Rota herdada, fora do catálogo. Ver o comentário em `index.ts`.
 *
 * Foi o endpoint mais usado da API e hoje o caminho é
 * `POST /imoveis/buscar` com `codigos` no corpo. Continua respondendo
 * porque o fluxo do N8N ainda aponta para cá, e continua devolvendo
 * **um objeto**, com `disponivel` do lado de fora, que é o contrato que
 * aquele fluxo espera.
 *
 * O lead chega pelo link do site com o código na primeira mensagem — é
 * essa a razão de `mensagemDeInteresse` carregar o código, registrada em
 * CLAUDE.md. Aqui esse código vira a ficha que o agente usa para
 * responder sobre o imóvel já na primeira resposta.
 */
export async function imovelPorCodigo(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  codigo: string,
): Promise<Response> {
  const limpo = codigo.trim().toUpperCase()

  if (!/^[A-Z]{2,5}-\d{1,10}$/.test(limpo)) {
    return erro(
      'parametro_invalido',
      'Esse código não parece um código de imóvel. Eles têm o formato IMV-0001.',
    )
  }

  const { data, error } = await supabase
    .from('imoveis')
    .select(CAMPOS_COMPLETO)
    .eq('codigo', limpo)
    .maybeSingle()

  if (error) throw error

  // As duas possibilidades reais são tratadas juntas porque a API não
  // consegue distingui-las: a exclusão de imóvel é definitiva, e um
  // código que já existiu fica idêntico a um código digitado errado.
  if (!data) {
    return erro(
      'imovel_nao_encontrado',
      `Não encontrei o imóvel ${limpo}. Ele pode ter sido vendido, alugado ou retirado do anúncio, ou o código pode estar diferente. Quer me dizer o que você procura que eu vejo outras opções?`,
    )
  }

  const ficha = fichaCompleta(data as never, await urlDoSite(supabase))
  const inativo = (data as { status: string }).status !== 'ativo'

  await registrar(supabase, consumidor, {
    acao: AcoesApi.imovelConsultado,
    tabela: 'imoveis',
    idRegistro: (data as { id: string }).id,
    dadosNovos: { codigo: limpo },
  })

  // Imóvel desativado responde, mas avisa. O agente precisa da ficha
  // para explicar do que o cliente está falando; o que ele não pode é
  // oferecer como se estivesse disponível.
  //
  // O aviso pode vir depois da frase sem risco de grudar num link:
  // imóvel fora do ar não tem `url` (a vitrine só publica ativos), então
  // `fraseDoImovel` termina em ponto justamente neste caso.
  const mensagem = inativo
    ? `${fraseDoImovel(ficha)} Este imóvel não está mais disponível no momento, mas posso mostrar opções parecidas.`
    : fraseDoImovel(ficha)

  return sucesso(ficha, mensagem, { disponivel: !inativo })
}

/* ------------------------------------------------------------------ */
/* POST /imoveis/codigos                                               */
/* ------------------------------------------------------------------ */

/** Teto de fichas por chamada. Ver o comentário em `imoveisPorCodigos`. */
const MAXIMO_CODIGOS = 5

/**
 * Fichas de vários imóveis de uma vez.
 *
 * Existe porque a pessoa manda "vi o IMV-0001 e o IMV-0007" numa
 * mensagem só, e duas chamadas para responder uma frase é ida e volta
 * que o atendimento não precisa.
 *
 * **A resposta é sempre lista**, mesmo com um código só. Endpoint que
 * devolve objeto às vezes e lista outras funciona no teste com um item e
 * quebra no dia em que o cliente cita dois.
 *
 * É esta função que atende `POST /imoveis/buscar` quando o corpo traz
 * `codigos`. A rota `/imoveis/codigos` continua existindo, fora do
 * catálogo, pelo mesmo motivo do `GET` acima.
 *
 * O teto de cinco não é arbitrário: a ficha aqui é a **completa**, com
 * descrição e características, e cinco delas já são bastante texto
 * entrando no contexto do agente. Passar do teto não é erro, é aviso: os
 * cinco primeiros são consultados e a mensagem conta o resto.
 */
export async function imoveisPorCodigos(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  const bruto = corpo.codigos ?? corpo.codigo

  // Aceita lista ou texto com vírgulas: o N8N monta os dois com a mesma
  // facilidade, e exigir um formato só seria armadilha sem motivo.
  const entrada = Array.isArray(bruto)
    ? bruto.map((c) => String(c))
    : typeof bruto === 'string'
      ? bruto.split(',')
      : []

  if (entrada.length === 0) {
    return erro(
      'parametro_invalido',
      'Preciso de pelo menos um código de imóvel, no campo "codigos". Ex.: "IMV-0001, IMV-0007".',
    )
  }

  const pedidos: string[] = []
  const invalidos: string[] = []
  for (const item of entrada) {
    if (!item.trim()) continue
    const codigo = normalizarCodigo(item)
    if (!codigo) invalidos.push(item.trim())
    else if (!pedidos.includes(codigo)) pedidos.push(codigo)
  }

  if (pedidos.length === 0) {
    // Duas situações diferentes, e a frase precisa distingui-las. Com
    // `{"codigos": ""}` ou `{"codigos": [" "]}` não há termo nenhum para
    // citar, e a frase de "não reconheci" sairia com um buraco no meio:
    // "Não reconheci  como código de imóvel."
    return erro(
      'parametro_invalido',
      invalidos.length === 0
        ? 'O campo "codigos" veio vazio. Me passe o código do imóvel, no formato IMV-0001, ou os filtros do que a pessoa procura.'
        : `Não reconheci ${listar(invalidos, 'nem')} como código de imóvel. Eles têm o formato IMV-0001.`,
    )
  }

  const excedentes = pedidos.slice(MAXIMO_CODIGOS)
  const consultados = pedidos.slice(0, MAXIMO_CODIGOS)

  const { data, error } = await supabase
    .from('imoveis')
    .select(CAMPOS_COMPLETO)
    .in('codigo', consultados)

  if (error) throw error

  const base = await urlDoSite(supabase)

  const fichas = (data ?? []).map((bruto) => ({
    ...fichaCompleta(bruto as never, base),
    // `disponivel` é por imóvel e por isso mora dentro de cada um. No
    // endpoint de código único ele fica fora, ao lado do `dados`, porque
    // lá só existe um.
    disponivel: (bruto as { status: string }).status === 'ativo',
  }))

  const naoEncontrados = consultados.filter((c) => !fichas.some((f) => f.codigo === c))

  await registrar(supabase, consumidor, {
    acao: AcoesApi.imovelConsultado,
    tabela: 'imoveis',
    dadosNovos: { codigos: consultados, encontrados: fichas.length },
  })

  return sucesso(fichas, montarMensagem(fichas, naoEncontrados, invalidos, excedentes), {
    nao_encontrados: naoEncontrados,
  })
}

/**
 * A frase que o agente repassa.
 *
 * Ela precisa dar conta de quatro coisas ao mesmo tempo: o que foi
 * achado, o que não existe, o que veio escrito errado e o que passou do
 * teto. Nenhuma dessas quatro é erro suficiente para derrubar a
 * consulta, então todas viram texto.
 *
 * **As partes são separadas por quebra de linha, e não por espaço.**
 * Cada frase de imóvel pode terminar num link, e a frase seguinte colada
 * nele com um espaço vira, em boa parte dos clientes de mensagem, um
 * endereço com palavra grudada no fim.
 */
function montarMensagem(
  fichas: (ReturnType<typeof fichaCompleta> & { disponivel: boolean })[],
  naoEncontrados: string[],
  invalidos: string[],
  excedentes: string[],
): string {
  const partes: string[] = []

  if (fichas.length === 0) {
    partes.push(
      `Não encontrei ${listar(naoEncontrados, 'nem')}. Pode ter sido vendido, alugado ou retirado do anúncio.`,
    )
  } else if (fichas.length === 1) {
    // Ponto, e não dois pontos: a frase do imóvel já abre com
    // "IMV-0001:", e "Encontrei 1 imóvel: IMV-0001: ..." lê como erro de
    // digitação. Com vários, o cabeçalho fica antes da quebra de linha e
    // aí os dois pontos voltam a fazer sentido, porque introduzem lista.
    partes.push(`Encontrei 1 imóvel. ${fraseDoImovel(fichas[0])}`)
  } else {
    partes.push(`Encontrei ${fichas.length} imóveis:`, listaDeImoveis(fichas))
  }

  const indisponiveis = fichas.filter((f) => !f.disponivel).map((f) => f.codigo)
  if (indisponiveis.length > 0) {
    partes.push(
      indisponiveis.length === 1
        ? `O ${indisponiveis[0]} não está mais disponível no momento.`
        : `${listar(indisponiveis, 'e')} não estão mais disponíveis no momento.`,
    )
  }

  if (fichas.length > 0 && naoEncontrados.length > 0) {
    partes.push(`Já ${listar(naoEncontrados, 'e')} eu não encontrei.`)
  }

  if (invalidos.length > 0) {
    partes.push(`Não reconheci ${listar(invalidos, 'nem')} como código.`)
  }

  if (excedentes.length > 0) {
    partes.push(
      `Consultei os ${MAXIMO_CODIGOS} primeiros. Se precisar de ${listar(excedentes, 'e')}, me peça em seguida.`,
    )
  }

  return partes.join('\n')
}

/* ------------------------------------------------------------------ */
/* POST /imoveis/buscar                                                */
/* ------------------------------------------------------------------ */

export interface FiltrosBusca {
  finalidade?: 'venda' | 'locacao'
  /**
   * Termos pedidos, já normalizados, guardados para as frases de
   * relaxamento. O que vai para a consulta são os campos resolvidos
   * logo abaixo.
   */
  tipo_imovel?: string[]
  cidade?: string[]
  bairro?: string[]
  valor_min?: number
  valor_max?: number
  quartos_min?: number
  banheiros_min?: number
  vagas_min?: number
  area_min?: number
  mobiliado?: boolean
  aceita_pet?: boolean
  /**
   * Ids resolvidos a partir de `tipo_imovel`, preenchidos antes da
   * consulta. **Não filtre por `tipos_imovel.nome` na consulta
   * embutida**: no PostgREST isso filtra o recurso aninhado e não a
   * linha do imóvel — o resultado volta com todos os imóveis e o tipo
   * nulo nos que não casam, o que parece funcionar e não funciona.
   */
  ids_tipo?: string[]
  /**
   * Cidades e bairros como estão gravados, com acento, resolvidos a
   * partir dos termos pedidos. A comparação sem acento acontece em
   * memória; a consulta filtra por valor exato.
   */
  cidades_exatas?: string[]
  bairros_exatos?: string[]
}

/* ------------------------------------------------------------------ */
/* Tolerância de entrada                                               */
/* ------------------------------------------------------------------ */

/**
 * Sinônimos de finalidade.
 *
 * `ambos` e companhia mapeiam para `ambos`, que significa **não
 * filtrar**. Não confundir com o valor `ambos` da coluna `finalidade`,
 * que é atributo do imóvel: aquele já entra nas duas buscas por conta
 * do `in` lá embaixo.
 */
const FINALIDADES: Record<string, 'venda' | 'locacao' | 'ambos'> = {
  venda: 'venda',
  vender: 'venda',
  vendas: 'venda',
  comprar: 'venda',
  compra: 'venda',
  'a venda': 'venda',
  'para venda': 'venda',
  'para comprar': 'venda',

  locacao: 'locacao',
  locar: 'locacao',
  aluguel: 'locacao',
  alugar: 'locacao',
  alugue: 'locacao',
  'para alugar': 'locacao',
  'para locacao': 'locacao',
  arrendamento: 'locacao',
  arrendar: 'locacao',

  ambos: 'ambos',
  ambas: 'ambos',
  todos: 'ambos',
  qualquer: 'ambos',
  indiferente: 'ambos',
  'tanto faz': 'ambos',
  'os dois': 'ambos',
}

/**
 * Apelidos de tipo de imóvel.
 *
 * **Isto não substitui a lista de tipos do banco**, que a imobiliária
 * edita em Configurações. Aqui moram só as abreviações e os plurais que
 * o agente escreve e que não são substring do nome cadastrado: "apto"
 * não está contido em "Apartamento", então nenhuma comparação por
 * pedaço acharia sozinha.
 *
 * O valor à direita é o termo que vai ser procurado entre os tipos
 * reais, não um id. Tipo renomeado no painel continua funcionando.
 */
const APELIDOS_TIPO: Record<string, string> = {
  apto: 'apartamento',
  aptos: 'apartamento',
  ap: 'apartamento',
  apt: 'apartamento',
  apart: 'apartamento',
  apartamentos: 'apartamento',
  flat: 'apartamento',

  casas: 'casa',
  sobrados: 'sobrado',
  chacaras: 'chacara',
  sitios: 'sitio',
  fazendas: 'fazenda',
  terrenos: 'terreno',
  lote: 'terreno',
  lotes: 'terreno',
  coberturas: 'cobertura',
  galpoes: 'galpao',
  barracao: 'galpao',

  kit: 'kitnet',
  kits: 'kitnet',
  kitinete: 'kitnet',
  quitinete: 'kitnet',
  studio: 'kitnet',
  estudio: 'kitnet',

  sala: 'comercial',
  salas: 'comercial',
  'sala comercial': 'comercial',
  loja: 'comercial',
  lojas: 'comercial',
  'ponto comercial': 'comercial',
  comerciais: 'comercial',
}

type Consulta = ReturnType<typeof consultaBase>

function consultaBase(supabase: SupabaseClient) {
  // `count: 'exact'` porque o total entra na frase que o cliente lê.
  // Sem ele, uma carteira com 40 imóveis compatíveis responderia
  // "Encontrei 5 imóveis", que é o tamanho da página e não o tamanho do
  // resultado: o cliente concluiria que só existe isso e pararia de
  // perguntar. O count vem na mesma requisição, não é uma consulta a mais.
  return supabase
    .from('imoveis')
    .select(CAMPOS_RESUMO, { count: 'exact' })
    .eq('status', 'ativo')
}

/**
 * Aplica os filtros.
 *
 * Os termos de texto já chegam aqui limpos de curingas — ver
 * `termoDeBusca`. Não dá para escapar `%` e `_` com barra invertida no
 * caminho do PostgREST: verificado contra o banco, `ilike.%\%%` continua
 * casando com tudo, ou seja, a barra não vira escape. A limpeza precisa
 * acontecer antes de o padrão ser montado.
 */
function aplicar(consulta: Consulta, filtros: FiltrosBusca): Consulta {
  let q = consulta

  if (filtros.finalidade) {
    // `ambos` atende as duas pontas: um imóvel de venda e locação é
    // resposta válida para quem procura só uma delas.
    q = q.in('finalidade', [filtros.finalidade, 'ambos'])
  }
  if (filtros.ids_tipo && filtros.ids_tipo.length > 0) q = q.in('id_tipo_imovel', filtros.ids_tipo)
  if (filtros.cidades_exatas?.length) q = q.in('cidade', filtros.cidades_exatas)
  if (filtros.bairros_exatos?.length) q = q.in('bairro', filtros.bairros_exatos)
  if (filtros.quartos_min !== undefined) q = q.gte('quartos', filtros.quartos_min)
  if (filtros.banheiros_min !== undefined) q = q.gte('banheiros', filtros.banheiros_min)
  if (filtros.vagas_min !== undefined) q = q.gte('vagas', filtros.vagas_min)
  if (filtros.area_min !== undefined) q = q.gte('area_util', filtros.area_min)
  if (filtros.mobiliado !== undefined) q = q.eq('mobiliado', filtros.mobiliado)
  if (filtros.aceita_pet !== undefined) q = q.eq('aceita_pet', filtros.aceita_pet)

  // O valor é comparado contra a coluna que corresponde à finalidade
  // pedida. Sem isso, "até R$ 3.000" numa busca de locação deixaria de
  // fora todo imóvel de aluguel cujo valor de VENDA passasse disso, que
  // são todos eles.
  const temValor = filtros.valor_min !== undefined || filtros.valor_max !== undefined

  if (temValor && !filtros.finalidade) {
    // Sem finalidade não há coluna certa, então vale qualquer uma das
    // duas. Fixar em `valor_venda` aqui excluiria todo imóvel só de
    // aluguel, cujo valor de venda é nulo: "alugar ou comprar até 3 mil"
    // voltaria vazio, e vazio encerra o atendimento.
    q = q.or([faixa('valor_venda', filtros), faixa('valor_aluguel', filtros)].join(','))
  } else if (temValor) {
    const campo = filtros.finalidade === 'locacao' ? 'valor_aluguel' : 'valor_venda'
    if (filtros.valor_min !== undefined) q = q.gte(campo, filtros.valor_min)
    if (filtros.valor_max !== undefined) q = q.lte(campo, filtros.valor_max)
  }

  return q
}

/** Um lado do `or`: `and(coluna.gte.X,coluna.lte.Y)`, só com o que veio. */
function faixa(coluna: string, filtros: FiltrosBusca): string {
  const partes: string[] = []
  if (filtros.valor_min !== undefined) partes.push(`${coluna}.gte.${filtros.valor_min}`)
  if (filtros.valor_max !== undefined) partes.push(`${coluna}.lte.${filtros.valor_max}`)
  return partes.length === 1 ? partes[0] : `and(${partes.join(',')})`
}

/**
 * Prepara um termo de texto para entrar num `ilike`.
 *
 * Remove `%`, `_` e `\`, que no LIKE são curinga e não texto. Devolve
 * `null` quando **não sobra nada** — e aí o parâmetro é recusado, em vez
 * de o filtro ser descartado em silêncio. A diferença importa: descartar
 * transformaria uma busca por "%" em "me traga a carteira inteira", que
 * é exatamente o que a limpeza existe para impedir.
 */
/**
 * Casa os termos pedidos contra os valores que existem na carteira.
 *
 * Devolve os valores **como estão gravados**, com acento, porque é
 * assim que a consulta vai filtrar. Sem repetição, e vazio quando nada
 * casou, que é o sinal para o chamador não montar um `in` inválido.
 */
function casarLugares(termos: string[], valores: (string | null)[]): string[] {
  const catalogo = new Map<string, string>()
  for (const valor of valores) {
    if (valor) catalogo.set(valor, normalizar(valor))
  }

  const escolhidos = new Set<string>()
  for (const termo of termos) {
    for (const [original, normalizado] of catalogo) {
      if (casa(termo, normalizado)) escolhidos.add(original)
    }
  }

  return [...escolhidos]
}

/**
 * Relaxamentos, do mais restritivo ao menos.
 *
 * A ordem não é arbitrária. Bairro é o corte mais estreito de todos —
 * quem pede "Jardim Europa" costuma aceitar a rua de trás. Já o valor
 * vem por último e é **afrouxado em 20%, não removido**: oferecer um
 * imóvel de R$ 900 mil a quem falou em R$ 300 mil não é alternativa, é
 * ruído, e queima a confiança do cliente no atendimento.
 */
const RELAXAMENTOS: { campo: keyof FiltrosBusca; descrever: (f: FiltrosBusca) => string; aplicar: (f: FiltrosBusca) => FiltrosBusca }[] = [
  {
    campo: 'bairro',
    // A frase vai inteira para o cliente no WhatsApp, então precisa
    // concordar em número: "no bairro Moema", "nos bairros Moema, Itaim
    // e Tatuapé".
    descrever: (f) =>
      (f.bairro ?? []).length === 1
        ? `no bairro ${f.bairro?.[0]}`
        : `nos bairros ${listar(f.bairro ?? [], 'e')}`,
    aplicar: ({ bairro: _b, bairros_exatos: _be, ...resto }) => resto,
  },
  {
    campo: 'tipo_imovel',
    descrever: (f) =>
      (f.tipo_imovel ?? []).length === 1
        ? `do tipo ${f.tipo_imovel?.[0]}`
        : `dos tipos ${listar(f.tipo_imovel ?? [], 'e')}`,
    aplicar: ({ tipo_imovel: _t, ids_tipo: _i, ...resto }) => resto,
  },
  {
    campo: 'area_min',
    descrever: (f) => `com pelo menos ${f.area_min} m²`,
    aplicar: ({ area_min: _a, ...resto }) => resto,
  },
  {
    campo: 'vagas_min',
    descrever: (f) => `com ${f.vagas_min} ${f.vagas_min === 1 ? 'vaga' : 'vagas'}`,
    aplicar: ({ vagas_min: _v, ...resto }) => resto,
  },
  {
    campo: 'banheiros_min',
    descrever: (f) => `com ${f.banheiros_min} ${f.banheiros_min === 1 ? 'banheiro' : 'banheiros'}`,
    aplicar: ({ banheiros_min: _b, ...resto }) => resto,
  },
  {
    campo: 'mobiliado',
    descrever: (f) => (f.mobiliado ? 'mobiliado' : 'sem mobília'),
    aplicar: ({ mobiliado: _m, ...resto }) => resto,
  },
  {
    campo: 'quartos_min',
    descrever: (f) => `com ${f.quartos_min} ${f.quartos_min === 1 ? 'quarto' : 'quartos'}`,
    aplicar: ({ quartos_min: _q, ...resto }) => resto,
  },
  {
    campo: 'valor_max',
    descrever: (f) => `até ${moeda(f.valor_max ?? 0)}`,
    aplicar: (f) => ({ ...f, valor_max: Math.round((f.valor_max ?? 0) * 1.2) }),
  },
]

/**
 * O endpoint único de imóveis.
 *
 * Com `codigos` no corpo, responde por código. Sem, procura por
 * características. **É a mesma pergunta do cliente nos dois casos** —
 * "me fala desse imóvel" —, e a diferença é só por onde ele chegou: com
 * o código na mão, vindo do link do site, ou descrevendo o que quer.
 *
 * Antes eram três rotas, e a escolha entre elas era do agente. Escolha
 * de rota é decisão que um modelo pode errar sem que ninguém perceba: o
 * sintoma não é um erro, é uma resposta pior. Aqui ele manda o que tem e
 * a API decide.
 *
 * **O detalhe da ficha muda conforme a entrada, e é proposital.** Por
 * código vem a ficha completa, com descrição, características e todas as
 * fotos, no teto de 5. Por características vem o resumo, paginado. Vinte
 * fichas completas entupiriam o contexto do agente, e quem pede uma
 * lista quer escolher, não ler tudo.
 *
 * **Código manda sobre filtro.** Chegando os dois preenchidos, o código
 * é atendido e os filtros são ignorados: o código já identifica o imóvel,
 * e não há o que um filtro acrescente depois disso. `codigos` vazio conta
 * como ausente, o que deixa o agente mandar sempre o mesmo corpo e
 * preencher só o que sabe. Ver `temCodigo`.
 */
/**
 * Se o corpo pede imóveis por código.
 *
 * Aceita os dois nomes e as duas formas, porque o N8N monta as duas com
 * a mesma facilidade e exigir um formato só seria armadilha sem motivo.
 *
 * **Campo vazio conta como ausente**, e isso é o que permite ao agente
 * ter um schema só. No N8N o corpo é montado uma vez, com todos os
 * campos, e o modelo preenche o que sabe: quando não há código, `codigos`
 * chega como `""`, `null` ou `[]`. Recusar essas três formas faria toda
 * busca por características falhar num fluxo que sempre manda o mesmo
 * corpo — e o erro apareceria só em produção, na primeira pessoa que
 * chegasse sem citar imóvel.
 *
 * Com o campo vazio **e** sem filtro nenhum, a busca devolve a carteira
 * paginada, que é o que um corpo vazio já devolvia. A alternativa seria
 * recusar, mas aí o mesmo pedido teria duas respostas conforme o campo
 * viesse ausente ou em branco, o que ninguém consegue adivinhar.
 */
function temCodigo(corpo: Record<string, unknown>): boolean {
  return contemCodigo(corpo.codigos) || contemCodigo(corpo.codigo)
}

function contemCodigo(bruto: unknown): boolean {
  if (Array.isArray(bruto)) return bruto.some((item) => String(item).trim() !== '')
  if (typeof bruto === 'string') return bruto.trim() !== ''
  return typeof bruto === 'number'
}

export async function buscarImoveis(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  if (temCodigo(corpo)) return await imoveisPorCodigos(supabase, consumidor, corpo)

  const filtros = lerFiltros(corpo)
  if (typeof filtros === 'string') return erro('parametro_invalido', filtros)

  // O tipo chega como palavra ("apartamento", "apto") e vira id antes
  // da consulta. Resolver aqui, e não no filtro, também permite
  // reconhecer "não trabalhamos com esse tipo" como um caso próprio.
  //
  // A comparação é em memória, sobre a dezena de linhas de
  // `tipos_imovel`, porque `ilike` no banco não ignora acento: "sitio"
  // nunca acharia "Sítio", que é metade da carteira rural.
  if (filtros.tipo_imovel) {
    const { data: tipos } = await supabase.from('tipos_imovel').select('id, nome')
    const catalogo = (tipos ?? []).map((t) => ({ id: t.id, nome: normalizar(t.nome) }))

    const ids = new Set<string>()
    for (const termo of filtros.tipo_imovel) {
      const alvo = APELIDOS_TIPO[termo] ?? termo
      for (const tipo of catalogo) {
        if (casa(alvo, tipo.nome)) ids.add(tipo.id)
      }
    }
    filtros.ids_tipo = [...ids]
  }

  // Cidade e bairro seguem o mesmo caminho, mas o catálogo aqui é a
  // própria carteira. Uma consulta a mais por busca, e só quando o
  // filtro veio.
  if (filtros.cidade || filtros.bairro) {
    const { data: lugares } = await supabase
      .from('imoveis')
      .select('cidade, bairro')
      .eq('status', 'ativo')

    if (filtros.cidade) {
      filtros.cidades_exatas = casarLugares(filtros.cidade, (lugares ?? []).map((l) => l.cidade))
    }
    if (filtros.bairro) {
      filtros.bairros_exatos = casarLugares(filtros.bairro, (lugares ?? []).map((l) => l.bairro))
    }
  }

  const limite = Math.min(
    Math.max(Number(corpo.limite) || LIMITE_BUSCA_PADRAO(), 1),
    LIMITE_BUSCA_MAXIMO(),
  )
  const pagina = Math.max(Number(corpo.pagina) || 0, 0)

  const base = await urlDoSite(supabase)
  const { fichas: encontrados, total } = await executar(supabase, filtros, limite, pagina, base)

  await registrar(supabase, consumidor, {
    acao: AcoesApi.imoveisBuscados,
    tabela: 'imoveis',
    dadosNovos: { filtros, encontrados: encontrados.length, total },
  })

  if (encontrados.length > 0) {
    // Antes, com vários resultados, a mensagem citava só os três
    // primeiros códigos e o agente tinha de descrever os imóveis por
    // conta própria a partir de `dados`. Agora ela já vem com uma linha
    // por imóvel, cada uma terminando no link da página: é a resposta
    // que o cliente recebe sem que o modelo precise reescrever nada, e
    // é o que permite a ele abrir as fotos do que interessou.
    return sucesso(encontrados, fraseDaBusca(encontrados, total), {
      total,
      pagina,
      alternativas: [],
    })
  }

  /* --------------------------------------------------------------- */
  /* Nada exato: relaxa                                               */
  /* --------------------------------------------------------------- */
  // Lista vazia encerra o atendimento — a pessoa agradece e sai.
  // Alternativa mantém a conversa viva, que é onde o lead ainda existe.
  for (const relaxamento of RELAXAMENTOS) {
    if (filtros[relaxamento.campo] === undefined) continue

    const descricao = relaxamento.descrever(filtros)
    const { fichas: alternativos } = await executar(supabase, relaxamento.aplicar(filtros), limite, 0, base)
    if (alternativos.length === 0) continue

    return sucesso([], `Não achei nenhum imóvel ${descricao}, mas tenho ${alternativos.length === 1 ? 'esta opção parecida' : `estas ${alternativos.length} opções parecidas`}:\n${listaDeImoveis(alternativos)}`, {
      total: 0,
      pagina: 0,
      alternativas: alternativos,
      criterio_relaxado: relaxamento.campo,
    })
  }

  return sucesso([], 'Não encontrei nenhum imóvel com essas características no momento. Me conte o que é mais importante pra você que eu procuro de outro jeito.', {
    total: 0,
    pagina: 0,
    alternativas: [],
  })
}

/**
 * A frase da busca por características.
 *
 * **O total é o do resultado, não o da página**, e a diferença muda o
 * atendimento: numa carteira com 40 compatíveis, dizer "Encontrei 5
 * imóveis" faz o cliente concluir que só existe isso e parar de
 * perguntar. Dizer quantos são e mostrar os primeiros mantém aberta a
 * porta do "quer ver mais?".
 */
function fraseDaBusca(fichas: ReturnType<typeof fichaResumida>[], total: number): string {
  if (fichas.length === 1 && total === 1) {
    return `Encontrei 1 imóvel. ${fraseDoImovel(fichas[0])}`
  }

  const abertura =
    total > fichas.length
      ? `Encontrei ${total} imóveis. ${fichas.length === 1 ? 'Começo por este' : `Estes são os ${fichas.length} primeiros`}:`
      : `Encontrei ${total} imóveis:`

  return `${abertura}\n${listaDeImoveis(fichas)}`
}

async function executar(
  supabase: SupabaseClient,
  filtros: FiltrosBusca,
  limite: number,
  pagina: number,
  base: string | null,
) {
  // Tipo pedido que não existe na carteira: nenhuma consulta vai
  // devolver nada, e um `.in(…, [])` é sintaxe inválida no PostgREST.
  // Filtro pedido que não casou com nada na carteira: nenhuma consulta
  // devolveria resultado, e um `.in(…, [])` é sintaxe inválida no
  // PostgREST. Vale para os três, e é o que faz o relaxamento entrar:
  // bairro inexistente cai aqui, é removido no passo seguinte e a busca
  // volta a achar alternativas.
  if (filtros.tipo_imovel?.length && (filtros.ids_tipo ?? []).length === 0) return VAZIO
  if (filtros.cidade?.length && (filtros.cidades_exatas ?? []).length === 0) return VAZIO
  if (filtros.bairro?.length && (filtros.bairros_exatos ?? []).length === 0) return VAZIO

  // Ordena pelo valor da finalidade procurada, crescente: quem pede
  // "até X" quer ver o que cabe no orçamento, não o que chega no teto.
  const campoOrdem = filtros.finalidade === 'locacao' ? 'valor_aluguel' : 'valor_venda'

  const { data, error, count } = await aplicar(consultaBase(supabase), filtros)
    .order(campoOrdem, { ascending: true, nullsFirst: false })
    .range(pagina * limite, pagina * limite + limite - 1)

  if (error) throw error
  return {
    fichas: (data ?? []).map((linha) => fichaResumida(linha as never, base)),
    total: count ?? (data ?? []).length,
  }
}

/** Resultado de uma busca que nem chegou ao banco. Ver as guardas acima. */
const VAZIO = { fichas: [] as ReturnType<typeof fichaResumida>[], total: 0 }

/** Valida e normaliza o corpo. Devolve a mensagem de erro quando algo não serve. */
function lerFiltros(corpo: Record<string, unknown>): FiltrosBusca | string {
  const filtros: FiltrosBusca = {}

  if (corpo.finalidade !== undefined && corpo.finalidade !== null && corpo.finalidade !== '') {
    const escolhida = FINALIDADES[normalizar(String(corpo.finalidade))]

    // Valor irreconhecível derruba a busca, e a mensagem lista o que
    // vale. Ignorar em silêncio devolveria imóveis de venda para quem
    // quer alugar, sem ninguém perceber que o filtro caiu.
    if (!escolhida) {
      return 'Não entendi a finalidade. Use "venda", "locacao" ou "ambos". Também aceito comprar, vender, alugar e aluguel.'
    }

    // `ambos` significa não filtrar: fica fora de `filtros`.
    if (escolhida !== 'ambos') filtros.finalidade = escolhida
  }

  for (const chave of ['tipo_imovel', 'cidade', 'bairro'] as const) {
    const valor = corpo[chave]
    if (typeof valor !== 'string' || !valor.trim()) continue

    const termos = listaDeTermos(valor)
    if (termos.length === 0) return `Não entendi o valor de ${chave}.`
    filtros[chave] = termos
  }

  for (const chave of [
    'valor_min',
    'valor_max',
    'quartos_min',
    'banheiros_min',
    'vagas_min',
    'area_min',
  ] as const) {
    const valor = corpo[chave]
    if (valor === undefined || valor === null || valor === '') continue
    const numero = Number(valor)
    if (!Number.isFinite(numero) || numero < 0) return `O campo ${chave} precisa ser um número.`
    filtros[chave] = numero
  }

  if (
    filtros.valor_min !== undefined &&
    filtros.valor_max !== undefined &&
    filtros.valor_min > filtros.valor_max
  ) {
    return 'O valor mínimo não pode ser maior que o máximo.'
  }

  for (const chave of ['mobiliado', 'aceita_pet'] as const) {
    const valor = corpo[chave]
    if (valor === undefined || valor === null || valor === '') continue
    if (typeof valor !== 'boolean') return `O campo ${chave} precisa ser true ou false.`
    filtros[chave] = valor
  }

  return filtros
}

/* ------------------------------------------------------------------ */
/* GET /imoveis/ativos  ·  GET /imoveis/inativos                       */
/* ------------------------------------------------------------------ */

/**
 * Não existe endpoint de imóveis excluídos, e não deve existir.
 *
 * A exclusão é definitiva: o registro saiu do banco e não há de onde
 * lê-lo. O que restou dele está em `logs_sistema`, que é trilha de
 * auditoria do painel, não recurso de API.
 */
export async function listarPorStatus(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  status: 'ativo' | 'inativo',
  url: URL,
): Promise<Response> {
  const limite = Math.min(
    Math.max(Number(url.searchParams.get('limite')) || LIMITE_BUSCA_PADRAO(), 1),
    LIMITE_BUSCA_MAXIMO(),
  )
  const pagina = Math.max(Number(url.searchParams.get('pagina')) || 0, 0)

  const { data, error, count } = await supabase
    .from('imoveis')
    .select(CAMPOS_RESUMO, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(pagina * limite, pagina * limite + limite - 1)

  if (error) throw error

  // Em `/imoveis/inativos` todas as fichas saem com `url` nula, e é o
  // comportamento certo: a vitrine só publica ativos, então o endereço
  // de um imóvel fora do anúncio responde com a 404 pública.
  const base = await urlDoSite(supabase)
  const fichas = (data ?? []).map((linha) => fichaResumida(linha as never, base))

  await registrar(supabase, consumidor, {
    acao: AcoesApi.imoveisListados,
    tabela: 'imoveis',
    dadosNovos: { status, pagina, devolvidos: fichas.length },
  })

  const total = count ?? fichas.length
  const rotulo = status === 'ativo' ? 'disponíveis' : 'fora do anúncio'

  return sucesso(
    fichas,
    total === 0
      ? `No momento não há imóveis ${rotulo}.`
      : `São ${total} ${total === 1 ? 'imóvel' : 'imóveis'} ${rotulo}.`,
    { total, pagina, limite },
  )
}
