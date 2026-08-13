-- =====================================================================
-- ImobFlow — Etapa 2 — 13. Realtime em configuracoes
-- =====================================================================
-- O painel mantém uma subscription em `configuracoes` para que o que o
-- dono salva na tela de Configurações apareça na sidebar na hora, sem
-- recarregar a página (ver ContextoConfiguracoes.tsx).
--
-- Sem a tabela na publicação, essa subscription conecta normalmente e
-- simplesmente nunca recebe evento nenhum — falha silenciosa, sem erro
-- no console e sem nada que aponte a causa.
-- =====================================================================

alter table public.configuracoes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'configuracoes'
  ) then
    alter publication supabase_realtime add table public.configuracoes;
  end if;
end;
$$;
