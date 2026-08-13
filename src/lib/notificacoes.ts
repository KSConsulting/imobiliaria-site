import { toast } from 'sonner'

/**
 * Notificações padronizadas do sistema.
 *
 * Toda mensagem ao usuário passa por aqui, sempre em português. Chamar
 * `toast` do sonner diretamente numa tela contorna a padronização e é
 * como as mensagens acabam saindo em inglês ou com estilos diferentes
 * de uma tela para outra.
 */
export const notificar = {
  sucesso(mensagem: string, descricao?: string) {
    toast.success(mensagem, { description: descricao })
  },

  erro(mensagem: string, descricao?: string) {
    toast.error(mensagem, { description: descricao })
  },

  aviso(mensagem: string, descricao?: string) {
    toast.warning(mensagem, { description: descricao })
  },

  informacao(mensagem: string, descricao?: string) {
    toast.info(mensagem, { description: descricao })
  },

  /**
   * Traduz um erro vindo do Supabase para uma mensagem em português.
   *
   * As exceções lançadas pelos triggers do banco (conflito de agenda,
   * janela de atendimento, limite de fotos) já vêm em português e com o
   * contexto certo — ver BANCO.md, seção "Triggers". Nesses casos a
   * mensagem do banco é melhor do que qualquer texto genérico da
   * interface, então ela é exibida como está.
   */
  erroDoBanco(erro: unknown, mensagemPadrao = 'Não foi possível concluir a operação.') {
    const mensagem = extrairMensagem(erro)
    toast.error(mensagemPadrao, { description: mensagem })
  },
}

function extrairMensagem(erro: unknown): string | undefined {
  if (!erro) return undefined
  if (typeof erro === 'string') return erro
  if (typeof erro === 'object' && 'message' in erro) {
    const bruta = String((erro as { message: unknown }).message)
    return traduzir(bruta)
  }
  return undefined
}

/** Mensagens do Supabase Auth que aparecem com frequência no login. */
const TRADUCOES: Record<string, string> = {
  'Invalid login credentials': 'Email ou senha incorretos.',
  'Email not confirmed': 'Este email ainda não foi confirmado.',
  'User not found': 'Usuário não encontrado.',
  'Invalid email or password': 'Email ou senha incorretos.',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
  'Request rate limit reached': 'Muitas tentativas. Aguarde alguns minutos.',
  'Failed to fetch': 'Sem conexão com o servidor. Verifique sua internet.',
}

export function traduzir(mensagem: string): string {
  for (const [original, traducao] of Object.entries(TRADUCOES)) {
    if (mensagem.toLowerCase().includes(original.toLowerCase())) return traducao
  }
  return mensagem
}
