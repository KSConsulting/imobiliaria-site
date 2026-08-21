/**
 * Projeções de imóvel para a API.
 *
 * **Estas listas de colunas são a única proteção que existe aqui.** A
 * Edge Function roda com a service role key, que ignora o RLS: não há
 * política nenhuma entre este `select` e a tabela inteira. Um
 * `select('*')` devolveria `proprietario_nome`, `proprietario_contato` e
 * o endereço com número para dentro do WhatsApp de qualquer pessoa que
 * perguntasse pelo imóvel.
 *
 * Na vitrine, o RLS ao menos limitava a linha. Aqui nem isso.
 *
 * O endereço fica de fora pelo mesmo motivo da Etapa 6: imóvel anunciado
 * com frequência está vazio, e o endereço exato somado a fotos do
 * interior é informação que não deveria circular. Quem precisa dele
 * recebe no atendimento humano, depois do primeiro contato. `cep` entra
 * na mesma regra — em rua residencial ele identifica o quarteirão.
 */

import { urlDoImovel } from './configuracoes.ts'

/** Ficha completa: o que o agente precisa para descrever o imóvel. */
export const CAMPOS_COMPLETO = `
  id, codigo, titulo, descricao, finalidade, status,
  bairro, cidade, estado,
  valor_venda, valor_aluguel, valor_condominio, valor_iptu,
  area_total, area_util, quartos, suites, banheiros, vagas,
  mobiliado, aceita_pet, caracteristicas,
  tipos_imovel ( nome ),
  imoveis_fotos ( url, ordem, capa )
`

/** Versão resumida, para listas. Foto só a capa. */
export const CAMPOS_RESUMO = `
  id, codigo, titulo, finalidade, status,
  bairro, cidade, estado,
  valor_venda, valor_aluguel,
  quartos, banheiros, vagas, area_util, area_total,
  mobiliado, aceita_pet,
  tipos_imovel ( nome ),
  imoveis_fotos ( url, ordem, capa )
`

/**
 * Normaliza um código para o formato gravado no banco.
 *
 * Aceita o que o agente escreve de verdade: `IMV0001`, `imv-0001`,
 * `imv 1`, com espaço sobrando. Devolve `null` quando não sobra um
 * código plausível.
 *
 * **O prefixo é lido do que veio, nunca escrito aqui.** Ele muda por
 * nicho, vira `VEI` numa concessionária, e está registrado assim no
 * REPLICACAO.md. Um `'IMV-'` fixo nesta função seria o tipo de coisa que
 * só aparece na primeira replicação.
 *
 * O zero à esquerda é completado até quatro dígitos porque é assim que o
 * trigger 2 gera, com `lpad(v_numero, 4, '0')`: `IMV-1`, `IMV-029` e
 * `IMV-0029` são o mesmo imóvel, e não existe ambiguidade possível,
 * porque nenhum código nasce com menos de quatro dígitos. Acima de 9999
 * o número cresce sozinho, então nada é cortado.
 *
 * **Mora aqui, e não no handler, porque tem dois consumidores.** Nasceu
 * em `api/imoveis.ts` servindo só à busca, e a consequência apareceu na
 * primeira visita recusada: `/imoveis/buscar` achava o `IMV-029` e
 * `/agenda/agendar` não, então o mesmo código servia para perguntar
 * sobre o imóvel e falhava na hora de marcar, dentro da mesma conversa.
 * É a mesma regra do `telefone.ts`: uma função só, de cada lado da
 * fronteira.
 */
export function normalizarCodigo(bruto: string): string | null {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const partes = limpo.match(/^([A-Z]{2,5})(\d{1,10})$/)
  if (!partes) return null

  const [, prefixo, numero] = partes
  const semZeros = numero.replace(/^0+/, '') || '0'
  const acertado = semZeros.length < 4 ? semZeros.padStart(4, '0') : semZeros

  return `${prefixo}-${acertado}`
}

interface FotoBruta {
  url: string
  ordem: number
  capa: boolean
}

interface ImovelBruto {
  id: string
  codigo: string
  titulo: string
  descricao?: string | null
  finalidade: string
  status: string
  bairro: string
  cidade: string
  estado: string
  valor_venda: number | null
  valor_aluguel: number | null
  valor_condominio?: number | null
  valor_iptu?: number | null
  area_total: number | null
  area_util: number | null
  quartos: number
  suites?: number
  banheiros: number
  vagas: number
  mobiliado: boolean
  aceita_pet: boolean
  caracteristicas?: unknown
  tipos_imovel: { nome: string } | null
  imoveis_fotos: FotoBruta[] | null
}

function ordenarFotos(fotos: FotoBruta[] | null): FotoBruta[] {
  return [...(fotos ?? [])].sort((a, b) => {
    if (a.capa !== b.capa) return a.capa ? -1 : 1
    return a.ordem - b.ordem
  })
}

/** Diferenciais ficam em `caracteristicas` como array de strings. */
function diferenciais(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === 'string')
  return []
}

/**
 * Toda ficha sai com `codigo` e `url`, e o par não é decorativo.
 *
 * O `codigo` é o que amarra a conversa ao imóvel: é ele que chega na
 * primeira mensagem do cliente, por `mensagemDeInteresse`, e é por ele
 * que o agente volta a consultar, agenda e cancela.
 *
 * A `url` é o que o agente manda de volta, porque o que o cliente
 * pergunta em seguida é quase sempre pelas fotos, e descrever fotos por
 * texto não substitui vê-las. Ela vem montada aqui, e não deixada a
 * cargo do agente, para que o modelo nunca precise inventar um endereço:
 * link alucinado é indistinguível de link certo até alguém tocar nele.
 *
 * `base` é `null` antes de a vitrine ser publicada, e aí `url` é `null`
 * em todas as fichas. Ver `urlDoSite`, em `configuracoes.ts`.
 */
export function fichaCompleta(bruto: ImovelBruto, base: string | null) {
  const fotos = ordenarFotos(bruto.imoveis_fotos)

  return {
    codigo: bruto.codigo,
    url: urlDoImovel(base, bruto.codigo, bruto.status),
    titulo: bruto.titulo,
    descricao: bruto.descricao ?? null,
    tipo: bruto.tipos_imovel?.nome ?? null,
    finalidade: bruto.finalidade,
    bairro: bruto.bairro,
    cidade: bruto.cidade,
    estado: bruto.estado,
    valor_venda: bruto.valor_venda,
    valor_aluguel: bruto.valor_aluguel,
    valor_condominio: bruto.valor_condominio ?? null,
    valor_iptu: bruto.valor_iptu ?? null,
    area_total: bruto.area_total,
    area_util: bruto.area_util,
    quartos: bruto.quartos,
    suites: bruto.suites ?? 0,
    banheiros: bruto.banheiros,
    vagas: bruto.vagas,
    mobiliado: bruto.mobiliado,
    aceita_pet: bruto.aceita_pet,
    diferenciais: diferenciais(bruto.caracteristicas),
    foto_capa: fotos[0]?.url ?? null,
    fotos: fotos.map((foto) => foto.url),
  }
}

export function fichaResumida(bruto: ImovelBruto, base: string | null) {
  const fotos = ordenarFotos(bruto.imoveis_fotos)

  return {
    codigo: bruto.codigo,
    url: urlDoImovel(base, bruto.codigo, bruto.status),
    titulo: bruto.titulo,
    tipo: bruto.tipos_imovel?.nome ?? null,
    finalidade: bruto.finalidade,
    bairro: bruto.bairro,
    cidade: bruto.cidade,
    estado: bruto.estado,
    valor_venda: bruto.valor_venda,
    valor_aluguel: bruto.valor_aluguel,
    quartos: bruto.quartos,
    banheiros: bruto.banheiros,
    vagas: bruto.vagas,
    area_util: bruto.area_util,
    foto_capa: fotos[0]?.url ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Frases                                                              */
/* ------------------------------------------------------------------ */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function moeda(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : MOEDA.format(valor)
}

/** `R$ 450.000` ou `R$ 2.500/mês`, conforme a finalidade. */
export function valorFalado(ficha: { finalidade: string; valor_venda: number | null; valor_aluguel: number | null }): string {
  const partes: string[] = []
  if (ficha.valor_venda !== null && ficha.finalidade !== 'locacao') {
    partes.push(moeda(ficha.valor_venda))
  }
  if (ficha.valor_aluguel !== null && ficha.finalidade !== 'venda') {
    partes.push(`${moeda(ficha.valor_aluguel)}/mês`)
  }
  return partes.join(' ou ')
}

type Ficha = ReturnType<typeof fichaResumida> | ReturnType<typeof fichaCompleta>

/**
 * A frase que o agente repassa sobre um imóvel.
 *
 * Curta de propósito: o agente tem a ficha completa em `dados` e vai
 * compor a resposta dele. Esta frase é o resumo que serve quando ele
 * repassa sem reescrever nada.
 *
 * **O link fecha a frase, e nada vem depois dele.** Um ponto final
 * colado no fim de uma URL é incluído no endereço por vários clientes de
 * mensagem, e o link chega quebrado exatamente onde ele mais importa.
 * Pela mesma razão o código abre a frase com dois pontos e não com
 * travessão: esta frase inteira é lida por uma pessoa no WhatsApp, e a
 * convenção do projeto é que texto de cliente não leva travessão.
 */
export function fraseDoImovel(ficha: Ficha): string {
  const pedacos = [ficha.tipo ?? 'Imóvel', `no ${ficha.bairro}`, `em ${ficha.cidade}`]
  const comodos: string[] = []

  if (ficha.quartos > 0) comodos.push(`${ficha.quartos} ${ficha.quartos === 1 ? 'quarto' : 'quartos'}`)
  if (ficha.banheiros > 0) {
    comodos.push(`${ficha.banheiros} ${ficha.banheiros === 1 ? 'banheiro' : 'banheiros'}`)
  }
  if (ficha.vagas > 0) comodos.push(`${ficha.vagas} ${ficha.vagas === 1 ? 'vaga' : 'vagas'}`)

  const valor = valorFalado(ficha)

  return [
    `${ficha.codigo}: ${pedacos.join(' ')}`,
    comodos.length ? `, com ${comodos.join(', ')}` : '',
    valor ? `. ${valor}` : '',
    '.',
    ficha.url ? ` Fotos e detalhes: ${ficha.url}` : '',
  ].join('')
}

/**
 * Vários imóveis na mesma mensagem, um por linha.
 *
 * Antes de existir link, as frases cabiam numa lista corrida separada
 * por vírgula e "e". Com um endereço no fim de cada uma, a mesma lista
 * vira um parágrafo em que os links se encostam nas vírgulas e nenhuma
 * das opções se distingue da seguinte. Uma linha por imóvel é o formato
 * que o WhatsApp já usa para lista.
 */
export function listaDeImoveis(fichas: Ficha[]): string {
  return fichas.map((ficha) => fraseDoImovel(ficha)).join('\n')
}
