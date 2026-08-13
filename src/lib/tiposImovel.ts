import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'

export type TipoImovel = Tabelas['tipos_imovel']['Row']

export interface TipoComUso extends TipoImovel {
  /** Quantos imóveis usam este tipo, de qualquer status. */
  emUso: number
}

/**
 * Lista os tipos com a contagem de uso.
 *
 * A contagem vem embutida na própria consulta (`imoveis(count)`, uma
 * agregação do PostgREST no banco). Trazer os imóveis para contar no
 * navegador seria baixar o estoque inteiro para exibir onze números —
 * a mesma armadilha do Dashboard, descrita em CLAUDE.md.
 */
export async function listarTipos(): Promise<TipoComUso[]> {
  const { data, error } = await supabase
    .from('tipos_imovel')
    .select('id, nome, ativo, ordem, created_at, updated_at, imoveis(count)')
    .order('ordem')
    .order('nome')

  if (error) throw error

  const linhas = (data ?? []) as unknown as (TipoImovel & { imoveis: { count: number }[] })[]

  return linhas.map(({ imoveis, ...tipo }) => ({
    ...tipo,
    emUso: imoveis?.[0]?.count ?? 0,
  }))
}

export async function criarTipo(nome: string): Promise<TipoImovel> {
  // Entra no fim da lista. Inserir no topo mexeria na ordem que alguém
  // já arrumou à mão, e a ordem daqui é a ordem dos filtros do site.
  const { data: ultimo } = await supabase
    .from('tipos_imovel')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('tipos_imovel')
    .insert({ nome: nome.trim(), ordem: (ultimo?.ordem ?? 0) + 1 })
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.tipoImovelCriado,
    tabela: 'tipos_imovel',
    idRegistro: data.id,
    dadosNovos: data,
  })

  return data
}

export async function renomearTipo(tipo: TipoImovel, nome: string): Promise<TipoImovel> {
  const { data, error } = await supabase
    .from('tipos_imovel')
    .update({ nome: nome.trim() })
    .eq('id', tipo.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.tipoImovelAtualizado,
    tabela: 'tipos_imovel',
    idRegistro: tipo.id,
    dadosAnteriores: tipo,
    dadosNovos: data,
  })

  return data
}

/**
 * Liga e desliga o tipo.
 *
 * Desativar tira o tipo dos cadastros novos e dos filtros do site, mas
 * **não** mexe nos imóveis que já o usam — eles continuam publicados e
 * continuam aparecendo. É essa a diferença entre desativar e excluir, e
 * é o que faz a desativação ser a saída certa para "esse tipo não usamos
 * mais" sem perder o histórico.
 */
export async function alternarTipo(tipo: TipoImovel, ativo: boolean): Promise<TipoImovel> {
  const { data, error } = await supabase
    .from('tipos_imovel')
    .update({ ativo })
    .eq('id', tipo.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: ativo ? Acoes.tipoImovelAtivado : Acoes.tipoImovelDesativado,
    tabela: 'tipos_imovel',
    idRegistro: tipo.id,
    dadosAnteriores: { nome: tipo.nome, ativo: tipo.ativo },
    dadosNovos: { nome: data.nome, ativo: data.ativo },
  })

  return data
}

/**
 * Grava a nova ordem.
 *
 * Uma atualização por linha, e só nas que mudaram de posição. Um
 * `upsert` em lote seria uma chamada só, mas `tipos_imovel.nome` é
 * UNIQUE: o insert do upsert pode bater no índice do nome antes de bater
 * na chave primária, e aí o `on conflict` da primária não é acionado e o
 * banco recusa a operação inteira. Onze linhas não justificam esse risco.
 */
export async function reordenarTipos(ordenados: TipoImovel[]): Promise<void> {
  const mudaram = ordenados
    .map((tipo, indice) => ({ tipo, ordem: indice + 1 }))
    .filter(({ tipo, ordem }) => tipo.ordem !== ordem)

  if (mudaram.length === 0) return

  // A ordem de antes, reconstruída a partir do `ordem` que ainda está
  // nos registros. Sem ela o log registraria a nova ordem duas vezes e
  // não diria nada sobre o que mudou.
  const anterior = [...ordenados].sort((a, b) => a.ordem - b.ordem).map((t) => t.nome)

  for (const { tipo, ordem } of mudaram) {
    const { error } = await supabase.from('tipos_imovel').update({ ordem }).eq('id', tipo.id)
    if (error) throw error
  }

  await registrarLog({
    acao: Acoes.tiposImovelReordenados,
    tabela: 'tipos_imovel',
    dadosAnteriores: { ordem: anterior },
    dadosNovos: { ordem: ordenados.map((t) => t.nome) },
  })
}

/**
 * Exclui o tipo.
 *
 * A FK `imoveis.id_tipo_imovel` usa ON DELETE RESTRICT. Tipo em uso não
 * sai, e é assim que tem de ser: sem o RESTRICT, apagar "Apartamento"
 * apagaria em cascata todos os apartamentos do estoque. Quem chama
 * precisa traduzir o erro para a sugestão certa, que é desativar.
 */
export async function excluirTipo(tipo: TipoImovel): Promise<void> {
  await registrarLog({
    acao: Acoes.tipoImovelExcluido,
    tabela: 'tipos_imovel',
    idRegistro: tipo.id,
    dadosAnteriores: tipo,
  })

  const { error } = await supabase.from('tipos_imovel').delete().eq('id', tipo.id)
  if (error) throw error
}

function codigoDoErro(erro: unknown): string {
  return typeof erro === 'object' && erro && 'code' in erro
    ? String((erro as { code: unknown }).code)
    : ''
}

/** UNIQUE em `nome` violado — já existe tipo com esse nome. */
export function ehNomeDuplicado(erro: unknown): boolean {
  return codigoDoErro(erro) === '23505'
}

/** RESTRICT da FK de `imoveis` — o tipo está em uso. */
export function ehTipoEmUso(erro: unknown): boolean {
  const mensagem =
    typeof erro === 'object' && erro && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : ''
  return codigoDoErro(erro) === '23503' || mensagem.includes('imoveis_id_tipo_imovel_fkey')
}
