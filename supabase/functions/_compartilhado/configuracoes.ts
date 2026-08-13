import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { FUSO_PADRAO } from './ambiente.ts'

/**
 * Leituras do registro único de `configuracoes`.
 *
 * **Existe para que a regra não more em cópias.** `fusoDaImobiliaria`
 * estava escrita duas vezes, igual, em `agenda.ts` e em `contexto.ts`, e
 * a terceira cópia ia nascer aqui com a URL do site. É exatamente o
 * defeito que CLAUDE.md registra em "Um formato de telefone, e um lugar
 * só que decide": a normalização do WhatsApp existia em três lugares, e
 * corrigir dois deixou o terceiro gravando outro formato por semanas.
 */

/**
 * O fuso da imobiliária.
 *
 * Não é o do servidor nem o de quem chama: os triggers de conflito e de
 * janela convertem por esta coluna, então qualquer horário calculado com
 * outro fuso é oferecido e depois recusado pelo banco.
 */
export async function fusoDaImobiliaria(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from('configuracoes').select('fuso_horario').maybeSingle()
  return data?.fuso_horario ?? FUSO_PADRAO
}

/**
 * O endereço onde a vitrine está publicada, ou `null`.
 *
 * A Edge Function não tem como descobrir isso sozinha. O painel monta o
 * link do imóvel com `window.location.origin`, que é o navegador; aqui a
 * requisição vem do N8N e o domínio da própria função é o das Edge
 * Functions, não o da vitrine. Daí a coluna `url_site` (migration …021).
 *
 * **Não é a coluna `site`.** Aquela é o site institucional exibido no
 * rodapé, "se houver outro além da vitrine" nas palavras do próprio
 * campo. Usá-la aqui faria o agente mandar o link do site antigo, ou do
 * Instagram, dizendo que é a página do imóvel.
 *
 * Normaliza de novo na leitura, mesmo a tela já gravando normalizado,
 * porque o N8N escreve com service role e ignora tudo o que a tela
 * valida — e uma barra sobrando produziria `//imovel` no meio da URL.
 */
export async function urlDoSite(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from('configuracoes').select('url_site').maybeSingle()

  const bruto = (data?.url_site ?? '').trim()
  if (!bruto) return null

  const comProtocolo = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`
  return comProtocolo.replace(/\/+$/, '')
}

/**
 * A URL pública de um imóvel, ou `null`.
 *
 * `null` em dois casos, e o segundo é o que importa: **imóvel que não
 * está ativo não tem link.** A vitrine só publica ativos, então a página
 * de um imóvel desativado responde com a 404 pública. Mandar esse
 * endereço seria pior do que não mandar nada: o cliente clica, não acha,
 * e a conversa passa a ser sobre o link quebrado.
 */
export function urlDoImovel(base: string | null, codigo: string, status: string): string | null {
  if (!base || status !== 'ativo') return null
  return `${base}/imovel/${codigo}`
}
