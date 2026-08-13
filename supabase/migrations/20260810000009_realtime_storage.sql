-- =====================================================================
-- ImobFlow — Etapa 1 — 09. Realtime e Storage
-- =====================================================================

-- ---------------------------------------------------------------------
-- Realtime
--   crm_imobiliaria — Kanban do CRM se move sozinho quando o agente de
--                     IA muda o status do lead
--   agendamentos    — visitas marcadas pelo agente aparecem na Agenda
--                     sem recarregar a página
-- ---------------------------------------------------------------------
alter table public.crm_imobiliaria replica identity full;
alter table public.agendamentos    replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'crm_imobiliaria'
  ) then
    alter publication supabase_realtime add table public.crm_imobiliaria;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'agendamentos'
  ) then
    alter publication supabase_realtime add table public.agendamentos;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Storage — buckets públicos
--   logos   — identidade visual da imobiliária
--   imoveis — fotos servidas diretamente ao site público
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos',   'logos',   true,  5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('imoveis', 'imoveis', true, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
