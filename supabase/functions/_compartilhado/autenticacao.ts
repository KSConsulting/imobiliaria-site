import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { LIMITE_REQUISICOES } from './ambiente.ts'
import { erro } from './respostas.ts'

export interface Consumidor {
  idToken: string
  nome: string
}

/**
 * Autentica pelo cabeçalho `Authorization: Bearer <token>`.
 *
 * Devolve o consumidor, ou uma `Response` já pronta quando a chamada não
 * pode seguir. Quem chama testa qual dos dois veio — o padrão evita que
 * um `if` esquecido deixe passar uma requisição não autenticada, porque
 * sem o consumidor não há o que usar adiante.
 *
 * **A validação acontece aqui, nunca no cliente.** O agente roda no N8N,
 * e qualquer verificação do lado dele seria uma sugestão, não um
 * controle.
 */
export async function autenticar(
  requisicao: Request,
  supabase: SupabaseClient,
): Promise<Consumidor | Response> {
  const cabecalho = requisicao.headers.get('Authorization') ?? ''
  const token = cabecalho.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return erro(
      'nao_autorizado',
      'Esta requisição precisa do cabeçalho Authorization com um token da API.',
    )
  }

  const { data, error } = await supabase.rpc('fn_api_autenticar', {
    p_token: token,
    p_limite: LIMITE_REQUISICOES(),
    p_janela_segundos: 60,
  })

  if (error) {
    console.error('[autenticacao] falha ao validar o token:', error.message)
    return erro('erro_interno', 'Não consegui validar o acesso agora. Tente novamente.')
  }

  const linha = (data ?? [])[0] as
    | { id_token: string; nome: string; permitido: boolean; restante: number; reinicia_em: string }
    | undefined

  // Zero linhas cobre os dois casos — token inexistente e token revogado
  // — e a resposta não os distingue de propósito. Dizer "existe, mas foi
  // revogado" confirmaria a validade do valor para quem o obteve
  // indevidamente.
  if (!linha) {
    return erro('token_invalido', 'Token inválido ou revogado.')
  }

  if (!linha.permitido) {
    const segundos = Math.max(
      1,
      Math.ceil((new Date(linha.reinicia_em).getTime() - Date.now()) / 1000),
    )
    return erro(
      'limite_excedido',
      `Muitas requisições em sequência. Tente de novo em ${segundos} segundo${segundos === 1 ? '' : 's'}.`,
    )
  }

  return { idToken: linha.id_token, nome: linha.nome }
}

export function ehResposta(valor: unknown): valor is Response {
  return valor instanceof Response
}
