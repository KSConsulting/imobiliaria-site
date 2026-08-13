-- =====================================================================
-- ImobFlow — Etapa 1 — 02. Tabelas padrão
-- usuarios, api_tokens, configuracoes, logs_sistema
-- =====================================================================

-- ---------------------------------------------------------------------
-- usuarios — usuários do painel interno, espelham auth.users
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text        not null,
  email       text        not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.usuarios      is 'Usuários do painel interno. O id referencia auth.users.id (ON DELETE CASCADE).';
comment on column public.usuarios.id   is 'Mesmo id do usuário no Supabase Auth.';

-- ---------------------------------------------------------------------
-- api_tokens — tokens da API pública (agente de IA e sistemas externos)
-- ---------------------------------------------------------------------
create table if not exists public.api_tokens (
  id          uuid primary key default gen_random_uuid(),
  nome        text        not null,
  token       text        not null unique,
  ativo       boolean     not null default true,
  ultimo_uso  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.api_tokens            is 'Tokens de acesso à API pública. Um token por consumidor, revogável via ativo = false.';
comment on column public.api_tokens.nome       is 'Identifica quem consome o token (ex: agente_ia_whatsapp).';
comment on column public.api_tokens.ultimo_uso is 'Última vez que o token foi usado com sucesso.';

create index if not exists idx_api_tokens_token on public.api_tokens (token) where ativo;

-- ---------------------------------------------------------------------
-- configuracoes — dados da imobiliária. Registro único.
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  id                uuid primary key default gen_random_uuid(),
  nome_negocio      text        not null,
  logo_url          text,
  endereco          text,
  cep               text,
  cidade            text,
  estado            text,
  telefone          text,
  whatsapp          text,
  email             text,
  site              text,
  instagram         text,
  link_google_maps  text,
  fuso_horario      text        not null default 'America/Sao_Paulo',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table  public.configuracoes          is 'Dados da imobiliária. Registro único, alimenta site público e API simultaneamente.';
comment on column public.configuracoes.whatsapp is 'Número que recebe os cliques do botão de WhatsApp do site público.';

-- Garante registro único: índice único sobre expressão constante
create unique index if not exists uidx_configuracoes_registro_unico
  on public.configuracoes ((true));

-- ---------------------------------------------------------------------
-- logs_sistema — trilha de auditoria de todas as ações
-- ---------------------------------------------------------------------
create table if not exists public.logs_sistema (
  id               uuid primary key default gen_random_uuid(),
  id_usuario       uuid references public.usuarios (id) on delete set null,
  acao             text        not null,
  tabela           text,
  id_registro      text,
  dados_anteriores jsonb,
  dados_novos      jsonb,
  created_at       timestamptz not null default now()
);

comment on table public.logs_sistema is
  'Registro de todas as ações do sistema. Única fonte de rastreabilidade de imóveis excluídos, já que a exclusão de imóvel é definitiva.';

create index if not exists idx_logs_sistema_created_at on public.logs_sistema (created_at desc);
create index if not exists idx_logs_sistema_usuario    on public.logs_sistema (id_usuario);
create index if not exists idx_logs_sistema_tabela     on public.logs_sistema (tabela, id_registro);

-- ---------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at
  before update on public.usuarios
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_api_tokens_updated_at on public.api_tokens;
create trigger trg_api_tokens_updated_at
  before update on public.api_tokens
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_configuracoes_updated_at on public.configuracoes;
create trigger trg_configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.fn_set_updated_at();
