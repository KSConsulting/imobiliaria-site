import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { removerFotos, removerPastaDoImovel } from '@/lib/armazenamento'

export type Imovel = Tabelas['imoveis']['Row']
export type FotoImovel = Tabelas['imoveis_fotos']['Row']
export type TipoImovel = Tabelas['tipos_imovel']['Row']

/** Imóvel com o nome do tipo e as fotos, como a listagem precisa. */
export interface ImovelComRelacoes extends Imovel {
  tipos_imovel: { nome: string } | null
  imoveis_fotos: Pick<FotoImovel, 'id' | 'url' | 'ordem' | 'capa'>[]
}

export interface FiltrosImovel {
  busca: string
  finalidade: string
  tipo: string
  status: string
  cidade: string
  bairro: string
  valorMin: string
  valorMax: string
  quartos: string
  vagas: string
}

export const FILTROS_VAZIOS: FiltrosImovel = {
  busca: '',
  finalidade: '',
  tipo: '',
  status: '',
  cidade: '',
  bairro: '',
  valorMin: '',
  valorMax: '',
  quartos: '',
  vagas: '',
}

export function temFiltroAtivo(filtros: FiltrosImovel): boolean {
  return Object.values(filtros).some((valor) => valor !== '')
}

/**
 * Escapa o termo de busca para o operador `.or()` do PostgREST.
 *
 * Vírgula separa condições e parênteses agrupam: um usuário buscando
 * "Casa (fundos), Centro" montaria uma expressão inválida e a consulta
 * voltaria erro 400 em vez de resultado.
 */
function limparTermo(termo: string): string {
  return termo.replace(/[,()%\\]/g, ' ').trim()
}

/** Foto de capa: a marcada como capa ou, na ausência, a primeira da ordem. */
export function fotoDeCapa(imovel: ImovelComRelacoes): string | null {
  const fotos = imovel.imoveis_fotos ?? []
  if (fotos.length === 0) return null
  const capa = fotos.find((foto) => foto.capa)
  if (capa) return capa.url
  return [...fotos].sort((a, b) => a.ordem - b.ordem)[0].url
}

export async function listarImoveis(filtros: FiltrosImovel): Promise<ImovelComRelacoes[]> {
  let consulta = supabase
    .from('imoveis')
    .select('*, tipos_imovel(nome), imoveis_fotos(id, url, ordem, capa)')
    .order('created_at', { ascending: false })

  const termo = limparTermo(filtros.busca)
  if (termo) {
    consulta = consulta.or(
      [
        `codigo.ilike.%${termo}%`,
        `titulo.ilike.%${termo}%`,
        `bairro.ilike.%${termo}%`,
        `cidade.ilike.%${termo}%`,
      ].join(','),
    )
  }

  // "venda" também traz os de finalidade "ambos" — um imóvel que aceita
  // as duas coisas é, de fato, um imóvel à venda.
  if (filtros.finalidade === 'venda') consulta = consulta.in('finalidade', ['venda', 'ambos'])
  if (filtros.finalidade === 'locacao') consulta = consulta.in('finalidade', ['locacao', 'ambos'])

  if (filtros.tipo) consulta = consulta.eq('id_tipo_imovel', filtros.tipo)
  if (filtros.status) consulta = consulta.eq('status', filtros.status)
  if (filtros.cidade) consulta = consulta.ilike('cidade', filtros.cidade)
  if (filtros.bairro) consulta = consulta.ilike('bairro', filtros.bairro)
  if (filtros.quartos) consulta = consulta.gte('quartos', Number(filtros.quartos))
  if (filtros.vagas) consulta = consulta.gte('vagas', Number(filtros.vagas))

  const { data, error } = await consulta
  if (error) throw error

  let lista = (data ?? []) as unknown as ImovelComRelacoes[]

  // Faixa de valor no cliente: o valor a comparar depende da finalidade
  // filtrada, e isso não cabe num filtro simples do PostgREST.
  const min = filtros.valorMin ? Number(filtros.valorMin) : null
  const max = filtros.valorMax ? Number(filtros.valorMax) : null
  if (min !== null || max !== null) {
    lista = lista.filter((imovel) => {
      const valor = valorParaFiltro(imovel, filtros.finalidade)
      if (valor === null) return false
      if (min !== null && valor < min) return false
      if (max !== null && valor > max) return false
      return true
    })
  }

  return lista
}

function valorParaFiltro(imovel: Imovel, finalidade: string): number | null {
  if (finalidade === 'venda') return imovel.valor_venda
  if (finalidade === 'locacao') return imovel.valor_aluguel
  return imovel.valor_venda ?? imovel.valor_aluguel
}

/**
 * Total de imóveis cadastrados, sem filtro.
 *
 * Usado para distinguir "nenhum imóvel cadastrado" de "nenhum resultado
 * para o filtro" — dois estados vazios que pedem ações opostas. É uma
 * consulta de contagem com `head`, então não traz linha nenhuma.
 */
export async function contarImoveis(): Promise<number> {
  const { count, error } = await supabase
    .from('imoveis')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

export async function buscarImovel(id: string) {
  const { data, error } = await supabase
    .from('imoveis')
    .select('*, imoveis_fotos(id, url, ordem, capa)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as (Imovel & { imoveis_fotos: FotoImovel[] }) | null
}

export async function listarTiposImovel(): Promise<TipoImovel[]> {
  const { data, error } = await supabase
    .from('tipos_imovel')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')

  if (error) throw error
  return data ?? []
}

/** Cidades e bairros já cadastrados, para alimentar os filtros. */
export async function listarLocalidades() {
  const { data, error } = await supabase.from('imoveis').select('cidade, bairro')
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

export type DadosImovel = Omit<Tabelas['imoveis']['Insert'], 'codigo' | 'id'>

/**
 * Cria o imóvel.
 *
 * O `codigo` é omitido de propósito: quem o gera é o trigger
 * `trg_imoveis_gerar_codigo`, no formato IMV-XXXX, a partir de uma
 * sequence. Como a coluna é NOT NULL sem DEFAULT, o tipo gerado do
 * schema a considera obrigatória no insert — daí o cast. É o único
 * lugar do sistema que precisa dele.
 */
export async function criarImovel(dados: DadosImovel): Promise<Imovel> {
  const { data, error } = await supabase
    .from('imoveis')
    .insert(dados as Tabelas['imoveis']['Insert'])
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.imovelCriado,
    tabela: 'imoveis',
    idRegistro: data.id,
    dadosNovos: data,
  })

  return data
}

export async function atualizarImovel(
  id: string,
  dados: DadosImovel,
  anterior: Imovel,
): Promise<Imovel> {
  const { data, error } = await supabase
    .from('imoveis')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.imovelAtualizado,
    tabela: 'imoveis',
    idRegistro: id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  })

  return data
}

/**
 * Ativa ou desativa o imóvel.
 *
 * Desativar é REVERSÍVEL: remove o imóvel da vitrine e das consultas de
 * disponíveis da API, mas preserva integralmente o registro, as fotos e
 * os contadores. Não confundir com excluir.
 */
export async function alterarStatus(imovel: Imovel, novoStatus: 'ativo' | 'inativo') {
  const { data, error } = await supabase
    .from('imoveis')
    .update({ status: novoStatus })
    .eq('id', imovel.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: novoStatus === 'ativo' ? Acoes.imovelAtivado : Acoes.imovelDesativado,
    tabela: 'imoveis',
    idRegistro: imovel.id,
    dadosAnteriores: { status: imovel.status },
    dadosNovos: { status: novoStatus, codigo: imovel.codigo },
  })

  return data
}

/** Quantas visitas ainda agendadas existem para este imóvel. */
export async function contarVisitasAgendadas(idImovel: string): Promise<number> {
  const { count, error } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('id_imovel', idImovel)
    .eq('status', 'agendada')

  if (error) {
    console.warn('[imoveis] falha ao contar visitas:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Exclui o imóvel EM DEFINITIVO.
 *
 * Não existe lixeira e não existe recuperação — ver CLAUDE.md, "Regras
 * de negócio críticas". Por isso a ordem das operações importa:
 *
 * 1. Log com o registro completo ANTES de apagar. Depois do delete não
 *    há mais o que copiar, e o log é a única rastreabilidade que sobra.
 * 2. Delete no banco. As fotos somem por CASCADE e os agendamentos
 *    ficam com `id_imovel` nulo, preservando o `codigo_imovel` copiado.
 * 3. Limpeza do Storage por último. Banco e object storage são sistemas
 *    separados; se esta etapa falhar, sobra arquivo órfão, que é bem
 *    menos grave do que registro sem arquivo.
 */
export async function excluirImovel(
  imovel: Imovel & { imoveis_fotos?: Pick<FotoImovel, 'url'>[] },
): Promise<void> {
  await registrarLog({
    acao: Acoes.imovelExcluido,
    tabela: 'imoveis',
    idRegistro: imovel.id,
    dadosAnteriores: imovel,
  })

  const { error } = await supabase.from('imoveis').delete().eq('id', imovel.id)
  if (error) throw error

  await removerPastaDoImovel(imovel.id)
  const urls = (imovel.imoveis_fotos ?? []).map((foto) => foto.url)
  if (urls.length > 0) await removerFotos(urls)
}
