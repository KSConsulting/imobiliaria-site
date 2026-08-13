import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'

export type TokenApi = Tabelas['api_tokens']['Row']

/**
 * Prefixo dos tokens do ImobFlow.
 *
 * Serve a duas coisas concretas. Um token perdido num arquivo de
 * configuração do N8N é reconhecível de imediato — sem prefixo, ele
 * parece uma senha qualquer e ninguém sabe de onde tirar outro. E a API
 * da Etapa 9 pode recusar o que não começa com ele antes de consultar o
 * banco, o que transforma um teste de credencial em custo zero.
 */
export const PREFIXO_TOKEN = 'imf_'

/**
 * Gera um token de 32 bytes aleatórios em base64url.
 *
 * `crypto.getRandomValues` é o gerador criptográfico do navegador. Não
 * use `Math.random` aqui em hipótese nenhuma: ele é previsível, e um
 * token previsível é uma porta aberta na API pública.
 */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)

  const base64 = btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return PREFIXO_TOKEN + base64
}

/**
 * Versão para exibir em lista: `imf_A1b2C3d4…`
 *
 * O mascaramento aqui é conforto visual, não barreira de segurança — o
 * valor completo continua a um clique de distância, e precisa continuar,
 * porque a tela também é o lugar de onde ele é copiado para o N8N. O que
 * protege o token é o RLS: `api_tokens` não é legível por `anon` em
 * nenhuma hipótese (ver BANCO.md).
 */
export function mascararToken(token: string): string {
  return `${token.slice(0, PREFIXO_TOKEN.length + 6)}${'•'.repeat(8)}`
}

export async function listarTokens(): Promise<TokenApi[]> {
  const { data, error } = await supabase
    .from('api_tokens')
    .select('*')
    .order('ativo', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Cria o token e devolve a linha COM o valor.
 *
 * É a única vez em que a tela exibe o valor em destaque — não porque ele
 * some depois, mas porque é neste momento que ele precisa ir para o
 * lugar onde vai ser usado.
 */
export async function criarToken(nome: string): Promise<TokenApi> {
  const { data, error } = await supabase
    .from('api_tokens')
    .insert({ nome: nome.trim(), token: gerarToken() })
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.tokenCriado,
    tabela: 'api_tokens',
    idRegistro: data.id,
    dadosNovos: semSegredo(data),
  })

  return data
}

/**
 * Revoga ou reativa.
 *
 * Revogar não apaga: o índice de consulta da API é
 * `idx_api_tokens_token … where ativo`, então o token sai de circulação
 * na mesma consulta em que a Etapa 9 vai validá-lo, e a linha continua
 * ali contando quando foi criada e quando foi usada pela última vez.
 * Essa é justamente a informação que se quer ter depois de revogar algo
 * às pressas.
 */
export async function alternarToken(token: TokenApi, ativo: boolean): Promise<TokenApi> {
  const { data, error } = await supabase
    .from('api_tokens')
    .update({ ativo })
    .eq('id', token.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: ativo ? Acoes.tokenReativado : Acoes.tokenRevogado,
    tabela: 'api_tokens',
    idRegistro: token.id,
    dadosAnteriores: semSegredo(token),
    dadosNovos: semSegredo(data),
  })

  return data
}

export async function excluirToken(token: TokenApi): Promise<void> {
  await registrarLog({
    acao: Acoes.tokenExcluido,
    tabela: 'api_tokens',
    idRegistro: token.id,
    dadosAnteriores: semSegredo(token),
  })

  const { error } = await supabase.from('api_tokens').delete().eq('id', token.id)
  if (error) throw error
}

/**
 * Remove o valor do token antes de ele entrar na trilha de auditoria.
 *
 * **Esta função é a parte que não pode ser esquecida.** `logs_sistema`
 * não tem política de update nem de delete — o que entra ali não sai
 * nunca mais. Registrar a linha crua gravaria o segredo em texto puro,
 * de forma permanente, num lugar que qualquer usuário do painel lê e
 * que uma revogação futura não teria como limpar.
 */
function semSegredo(token: TokenApi) {
  const { token: _valor, ...resto } = token
  return { ...resto, token: mascararToken(token.token) }
}

/** Copia para a área de transferência. Devolve `false` quando o navegador recusa. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
