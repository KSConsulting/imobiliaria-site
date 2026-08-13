import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

/**
 * Cliente do Supabase dentro da Edge Function.
 *
 * **Aqui, e só aqui, roda a service role key.** Ela ignora todo o RLS, o
 * que é exatamente o necessário: a API precisa ler `api_tokens` (invisível
 * ao anônimo), escrever em `agendamentos` e `crm_imobiliaria` e registrar
 * na trilha, tudo sem sessão de usuário.
 *
 * A contrapartida é que **o RLS deixa de ser a rede de proteção**. Quem
 * decide o que sai daqui são as listas de colunas deste código — a mesma
 * lição da vitrine, registrada em CLAUDE.md: o RLS protege linha, não
 * coluna, e aqui nem linha ele protege.
 */
export function clienteAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !chave) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas nos secrets da função.',
    )
  }

  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Lê um número do ambiente, caindo no padrão quando ausente ou inválido. */
function numeroDoAmbiente(chave: string, padrao: number): number {
  const bruto = Deno.env.get(chave)
  if (!bruto) return padrao
  const numero = Number(bruto)
  return Number.isFinite(numero) && numero > 0 ? numero : padrao
}

/**
 * Antecedência mínima para agendar, em minutos.
 *
 * Existe porque "livre" e "possível" não são a mesma coisa: o bloco das
 * 15h continua vago às 14h58, e oferecê-lo marca uma visita que ninguém
 * consegue cumprir. Configurável porque a distância que a equipe precisa
 * é da imobiliária, não do sistema.
 */
export const ANTECEDENCIA_MINIMA = () => numeroDoAmbiente('ANTECEDENCIA_MINIMA_MINUTOS', 60)

/** Teto de requisições por token, por minuto. */
export const LIMITE_REQUISICOES = () => numeroDoAmbiente('LIMITE_REQUISICOES_MINUTO', 120)

/** Quantos imóveis a busca devolve por padrão, e no máximo. */
export const LIMITE_BUSCA_PADRAO = () => numeroDoAmbiente('LIMITE_BUSCA_PADRAO', 5)
export const LIMITE_BUSCA_MAXIMO = () => numeroDoAmbiente('LIMITE_BUSCA_MAXIMO', 20)

/** Duração do bloco de visita. Regra de negócio, não configuração. */
export const DURACAO_VISITA = 30

export const FUSO_PADRAO = 'America/Sao_Paulo'
