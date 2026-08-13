-- =====================================================================
-- ImobFlow — Etapa 1 — 08. Row Level Security
-- =====================================================================
-- Política padrão: usuários autenticados podem ler, inserir, atualizar e
-- excluir em todas as tabelas. As exceções estão comentadas tabela a
-- tabela.
-- =====================================================================

alter table public.usuarios           enable row level security;
alter table public.api_tokens         enable row level security;
alter table public.configuracoes      enable row level security;
alter table public.logs_sistema       enable row level security;
alter table public.crm_imobiliaria    enable row level security;
alter table public.tipos_imovel       enable row level security;
alter table public.imoveis            enable row level security;
alter table public.imoveis_fotos      enable row level security;
alter table public.corretores         enable row level security;
alter table public.agendas            enable row level security;
alter table public.agendas_horarios   enable row level security;
alter table public.agendamentos       enable row level security;
alter table public.visualizacoes_site enable row level security;

-- Privilégios de tabela (o RLS filtra por cima destes)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant select on public.imoveis, public.imoveis_fotos, public.tipos_imovel, public.configuracoes to anon;
grant insert on public.visualizacoes_site to anon;

-- ---------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------
drop policy if exists usuarios_autenticado_tudo on public.usuarios;
create policy usuarios_autenticado_tudo on public.usuarios
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- api_tokens — nunca exposto a anon. A validação do token acontece na
-- Edge Function, que usa service_role.
-- ---------------------------------------------------------------------
drop policy if exists api_tokens_autenticado_tudo on public.api_tokens;
create policy api_tokens_autenticado_tudo on public.api_tokens
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- configuracoes — leitura anônima (alimenta o rodapé/cabeçalho do site)
-- ---------------------------------------------------------------------
drop policy if exists configuracoes_anon_leitura on public.configuracoes;
create policy configuracoes_anon_leitura on public.configuracoes
  for select to anon using (true);

drop policy if exists configuracoes_autenticado_tudo on public.configuracoes;
create policy configuracoes_autenticado_tudo on public.configuracoes
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- logs_sistema — apenas leitura e inserção. Sem update, sem delete.
-- ---------------------------------------------------------------------
drop policy if exists logs_sistema_autenticado_leitura on public.logs_sistema;
create policy logs_sistema_autenticado_leitura on public.logs_sistema
  for select to authenticated using (true);

drop policy if exists logs_sistema_autenticado_insercao on public.logs_sistema;
create policy logs_sistema_autenticado_insercao on public.logs_sistema
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- crm_imobiliaria — autenticados + service_role (agente de IA via API)
-- ---------------------------------------------------------------------
drop policy if exists crm_autenticado_tudo on public.crm_imobiliaria;
create policy crm_autenticado_tudo on public.crm_imobiliaria
  for all to authenticated using (true) with check (true);

drop policy if exists crm_service_role_leitura on public.crm_imobiliaria;
create policy crm_service_role_leitura on public.crm_imobiliaria
  for select to service_role using (true);

drop policy if exists crm_service_role_insercao on public.crm_imobiliaria;
create policy crm_service_role_insercao on public.crm_imobiliaria
  for insert to service_role with check (true);

drop policy if exists crm_service_role_atualizacao on public.crm_imobiliaria;
create policy crm_service_role_atualizacao on public.crm_imobiliaria
  for update to service_role using (true) with check (true);

-- ---------------------------------------------------------------------
-- tipos_imovel — leitura anônima (filtros do site), escrita autenticada
-- ---------------------------------------------------------------------
drop policy if exists tipos_imovel_anon_leitura on public.tipos_imovel;
create policy tipos_imovel_anon_leitura on public.tipos_imovel
  for select to anon using (true);

drop policy if exists tipos_imovel_autenticado_tudo on public.tipos_imovel;
create policy tipos_imovel_autenticado_tudo on public.tipos_imovel
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- imoveis — leitura anônima restrita a status = 'ativo'
-- ---------------------------------------------------------------------
drop policy if exists imoveis_anon_leitura_ativos on public.imoveis;
create policy imoveis_anon_leitura_ativos on public.imoveis
  for select to anon using (status = 'ativo');

drop policy if exists imoveis_autenticado_tudo on public.imoveis;
create policy imoveis_autenticado_tudo on public.imoveis
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- imoveis_fotos — anon só enxerga fotos de imóvel ativo
-- ---------------------------------------------------------------------
drop policy if exists imoveis_fotos_anon_leitura_ativos on public.imoveis_fotos;
create policy imoveis_fotos_anon_leitura_ativos on public.imoveis_fotos
  for select to anon using (
    exists (
      select 1 from public.imoveis i
       where i.id = imoveis_fotos.id_imovel
         and i.status = 'ativo'
    )
  );

drop policy if exists imoveis_fotos_autenticado_tudo on public.imoveis_fotos;
create policy imoveis_fotos_autenticado_tudo on public.imoveis_fotos
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- corretores / agendas / agendas_horarios — apenas painel
-- ---------------------------------------------------------------------
drop policy if exists corretores_autenticado_tudo on public.corretores;
create policy corretores_autenticado_tudo on public.corretores
  for all to authenticated using (true) with check (true);

drop policy if exists agendas_autenticado_tudo on public.agendas;
create policy agendas_autenticado_tudo on public.agendas
  for all to authenticated using (true) with check (true);

drop policy if exists agendas_horarios_autenticado_tudo on public.agendas_horarios;
create policy agendas_horarios_autenticado_tudo on public.agendas_horarios
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- agendamentos — autenticados + service_role (agente de IA via API)
-- ---------------------------------------------------------------------
drop policy if exists agendamentos_autenticado_tudo on public.agendamentos;
create policy agendamentos_autenticado_tudo on public.agendamentos
  for all to authenticated using (true) with check (true);

drop policy if exists agendamentos_service_role_leitura on public.agendamentos;
create policy agendamentos_service_role_leitura on public.agendamentos
  for select to service_role using (true);

drop policy if exists agendamentos_service_role_insercao on public.agendamentos;
create policy agendamentos_service_role_insercao on public.agendamentos
  for insert to service_role with check (true);

drop policy if exists agendamentos_service_role_atualizacao on public.agendamentos;
create policy agendamentos_service_role_atualizacao on public.agendamentos
  for update to service_role using (true) with check (true);

drop policy if exists agendamentos_service_role_exclusao on public.agendamentos;
create policy agendamentos_service_role_exclusao on public.agendamentos
  for delete to service_role using (true);

-- ---------------------------------------------------------------------
-- visualizacoes_site — inserção anônima (rastreamento sem login)
-- ---------------------------------------------------------------------
drop policy if exists visualizacoes_anon_insercao on public.visualizacoes_site;
create policy visualizacoes_anon_insercao on public.visualizacoes_site
  for insert to anon with check (true);

drop policy if exists visualizacoes_autenticado_tudo on public.visualizacoes_site;
create policy visualizacoes_autenticado_tudo on public.visualizacoes_site
  for all to authenticated using (true) with check (true);
