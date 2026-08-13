import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import type { Consumidor } from './autenticacao.ts'

/**
 * Trilha de auditoria das chamadas da API.
 *
 * Grava em `logs_sistema`, a mesma tabela que o painel usa. Não há uma
 * tabela separada de propósito: quem abre a aba de Logs quer ver a
 * história completa do que aconteceu com um imóvel ou com um lead, e
 * duas trilhas paralelas obrigariam a pessoa a cruzar duas telas para
 * montar essa história.
 *
 * `id_usuario` fica nulo — não há usuário do painel do outro lado. Quem
 * agiu é o **consumidor do token**, e ele vai em `dados_novos.consumidor`.
 * A aba de Logs lê esse campo e exibe "Agente WhatsApp · via API" no
 * lugar de "Sistema", que não diria nada.
 *
 * **Nunca lança.** Auditoria que derruba a operação auditada é pior do
 * que auditoria ausente: o cliente perderia a visita por causa do log.
 */

/** Ações de leitura. O prefixo `api_` é o que `fn_log_categoria` usa. */
export const AcoesApi = {
  imovelConsultado: 'api_imovel_consultado',
  imoveisBuscados: 'api_imoveis_buscados',
  imoveisListados: 'api_imoveis_listados',
  disponibilidadeConsultada: 'api_disponibilidade_consultada',
  visitasConsultadas: 'api_visitas_consultadas',
  leadConsultado: 'api_lead_consultado',
} as const

/**
 * Ações de escrita: **os mesmos nomes que o painel usa.**
 *
 * Uma visita marcada pelo agente e uma marcada pela recepção são o mesmo
 * evento na vida da imobiliária, e precisam aparecer lado a lado na
 * mesma linha do tempo. O que diferencia as duas é o consumidor no
 * payload, não um nome de ação paralelo que quebraria o histórico do
 * agendamento em duas listas.
 */
export const AcoesEscrita = {
  leadCriado: 'lead_criado',
  agendamentoCriado: 'agendamento_criado',
  agendamentoAtualizado: 'agendamento_atualizado',
  agendamentoCancelado: 'agendamento_cancelado',
} as const

export interface EntradaLog {
  acao: string
  tabela?: string | null
  idRegistro?: string | null
  dadosAnteriores?: unknown
  dadosNovos?: Record<string, unknown>
}

export async function registrar(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  entrada: EntradaLog,
): Promise<void> {
  try {
    const { error } = await supabase.from('logs_sistema').insert({
      id_usuario: null,
      acao: entrada.acao,
      tabela: entrada.tabela ?? null,
      id_registro: entrada.idRegistro ?? null,
      dados_anteriores: entrada.dadosAnteriores ?? null,
      dados_novos: {
        ...(entrada.dadosNovos ?? {}),
        origem: 'api',
        consumidor: consumidor.nome,
      },
    })

    if (error) console.warn(`[logs_sistema] falha ao registrar "${entrada.acao}":`, error.message)
  } catch (falha) {
    console.warn(`[logs_sistema] falha ao registrar "${entrada.acao}":`, falha)
  }
}
