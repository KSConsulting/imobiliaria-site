/// <reference types="vite/client" />

/**
 * Variáveis de ambiente do frontend.
 *
 * Declaradas aqui para que `import.meta.env` deixe de ser `any`: sem
 * isso, um erro de digitação em `VITE_SUPABSE_URL` passaria pela
 * checagem de tipos e só apareceria em tempo de execução.
 *
 * **Toda variável desta lista vai para o bundle e é pública.** Segredo
 * nenhum entra aqui — a service role key e os tokens vivem apenas nos
 * secrets das Edge Functions. Ver README.md, seção "Variáveis de
 * ambiente".
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
