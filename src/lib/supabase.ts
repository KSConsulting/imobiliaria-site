import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/tipos/banco'

const url = import.meta.env.VITE_SUPABASE_URL
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !chaveAnonima) {
  throw new Error(
    'Variáveis de ambiente do Supabase ausentes. ' +
      'Copie o arquivo .env.example para .env e preencha ' +
      'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  )
}

/**
 * Cliente único do Supabase, usado pelas duas áreas do sistema.
 *
 * A chave anônima é pública por design: ela apenas identifica o projeto.
 * Quem decide o que cada visitante enxerga é o RLS do Postgres — ver
 * BANCO.md, seção "Políticas de RLS". A service role key, que ignora o
 * RLS, nunca entra no frontend.
 */
export const supabase = createClient<Database>(url, chaveAnonima, {
  auth: {
    // Mantém a sessão entre recarregamentos da página
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Tipos de linha das tabelas, para uso nas telas. */
export type Tabelas = Database['public']['Tables']
export type Configuracao = Tabelas['configuracoes']['Row']
export type Usuario = Tabelas['usuarios']['Row']
