import { supabase } from '@/lib/supabase'

/**
 * Registro de ações em `logs_sistema`.
 *
 * Esta é a ÚNICA porta de entrada para a trilha de auditoria. Todas as
 * etapas seguintes devem usá-la — nenhuma tela escreve em `logs_sistema`
 * diretamente.
 *
 * Por que ela importa tanto: a exclusão de imóvel é definitiva (ver
 * BANCO.md). Depois que o registro sai do banco, o log é a única coisa
 * que resta. Um `delete` sem `registrarLog` antes é informação perdida
 * para sempre.
 *
 * Convenção do nome da ação: `entidade_acao`, sempre no passado e em
 * minúsculas — `imovel_criado`, `imovel_excluido`, `lead_atualizado`.
 */

export interface ParametrosLog {
  /** Ex: `imovel_excluido`. Ver convenção acima. */
  acao: string
  /** Tabela afetada, ex: `imoveis`. */
  tabela?: string
  /** Id do registro afetado. É `text` no banco justamente porque o
   *  registro referenciado pode não existir mais. */
  idRegistro?: string
  /** Estado ANTES da ação. Obrigatório na prática em update e delete. */
  dadosAnteriores?: unknown
  /** Estado DEPOIS da ação. Obrigatório na prática em insert e update. */
  dadosNovos?: unknown
}

/** Ações já previstas. Use as constantes em vez de digitar a string. */
export const Acoes = {
  imovelCriado: 'imovel_criado',
  imovelAtualizado: 'imovel_atualizado',
  imovelExcluido: 'imovel_excluido',
  imovelAtivado: 'imovel_ativado',
  imovelDesativado: 'imovel_desativado',
  fotoAdicionada: 'foto_adicionada',
  fotoRemovida: 'foto_removida',
  leadCriado: 'lead_criado',
  leadAtualizado: 'lead_atualizado',
  leadExcluido: 'lead_excluido',
  corretorCriado: 'corretor_criado',
  corretorAtualizado: 'corretor_atualizado',
  corretorExcluido: 'corretor_excluido',
  agendamentoCriado: 'agendamento_criado',
  agendamentoAtualizado: 'agendamento_atualizado',
  agendamentoCancelado: 'agendamento_cancelado',
  configuracoesAtualizadas: 'configuracoes_atualizadas',
  tipoImovelCriado: 'tipo_imovel_criado',
  tipoImovelAtualizado: 'tipo_imovel_atualizado',
  tipoImovelAtivado: 'tipo_imovel_ativado',
  tipoImovelDesativado: 'tipo_imovel_desativado',
  tipoImovelExcluido: 'tipo_imovel_excluido',
  tiposImovelReordenados: 'tipos_imovel_reordenados',
  tokenCriado: 'token_criado',
  tokenRevogado: 'token_revogado',
  tokenReativado: 'token_reativado',
  tokenExcluido: 'token_excluido',
  loginRealizado: 'login_realizado',
  logoutRealizado: 'logout_realizado',
} as const

/**
 * Grava uma ação na trilha de auditoria.
 *
 * **Nunca lança.** Auditoria que derruba a operação auditada é pior do
 * que auditoria ausente: o usuário perderia o trabalho por causa do log.
 * Falhas vão para o console como aviso.
 *
 * O `id_usuario` é preenchido a partir da sessão corrente. Sem sessão,
 * fica nulo — e a política de RLS de `logs_sistema` só permite inserção
 * a usuários autenticados, então chamadas vindas do site público são
 * descartadas pelo banco, como esperado.
 */
export async function registrarLog({
  acao,
  tabela,
  idRegistro,
  dadosAnteriores,
  dadosNovos,
}: ParametrosLog): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { error } = await supabase.from('logs_sistema').insert({
      id_usuario: session?.user.id ?? null,
      acao,
      tabela: tabela ?? null,
      id_registro: idRegistro ?? null,
      dados_anteriores: paraJson(dadosAnteriores),
      dados_novos: paraJson(dadosNovos),
    })

    if (error) {
      console.warn(`[logs_sistema] falha ao registrar "${acao}":`, error.message)
    }
  } catch (erro) {
    console.warn(`[logs_sistema] falha ao registrar "${acao}":`, erro)
  }
}

/** Normaliza o valor para o formato aceito por uma coluna `jsonb`. */
function paraJson(valor: unknown) {
  if (valor === undefined || valor === null) return null
  return JSON.parse(JSON.stringify(valor))
}
