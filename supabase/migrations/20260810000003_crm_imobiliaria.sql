-- =====================================================================
-- ImobFlow — Etapa 1 — 03. crm_imobiliaria (tabela principal de leads)
-- =====================================================================

create table if not exists public.crm_imobiliaria (
  id                        uuid primary key default gen_random_uuid(),

  -- Base
  whatsapp                  text        not null unique,
  nome                      text,
  email                     text,
  tipo                      text        not null default 'lead',
  status                    text        not null default 'novo',
  origem                    text,
  observacoes               text,

  -- Nicho imobiliário
  codigo_imovel_interesse   text,
  finalidade_interesse      text,
  tipo_imovel_interesse     text,
  faixa_valor_min           numeric,
  faixa_valor_max           numeric,

  -- Agente de IA
  motivo_contato            text,
  resumo_conversa           text,
  inicio_atendimento        timestamptz,
  ultima_mensagem           timestamptz,
  minutos_ultima_mensagem   integer,
  data_agendamento          timestamptz,
  id_agendamento            text,
  follow_up_1               timestamptz,
  follow_up_2               timestamptz,

  -- Chatwoot
  id_conta_chatwoot         text,
  id_conversa_chatwoot      text,
  id_lead_chatwoot          text,
  inbox_id_chatwoot         text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint crm_imobiliaria_tipo_valido
    check (tipo in ('lead', 'cliente')),

  constraint crm_imobiliaria_status_valido
    check (status in ('novo', 'conversando', 'agendou', 'cancelou', 'visitou', 'follow_up_1', 'follow_up_2')),

  constraint crm_imobiliaria_finalidade_interesse_valida
    check (finalidade_interesse is null or finalidade_interesse in ('venda', 'locacao'))
);

comment on table public.crm_imobiliaria is
  'Tabela principal de leads. Alimenta a página de Leads e o Kanban do CRM. whatsapp é a chave natural (UNIQUE), o que permite ao agente de IA operar por upsert.';

comment on column public.crm_imobiliaria.whatsapp is
  'Chave natural do lead. UNIQUE — permite upsert pelo agente de IA e elimina leads duplicados.';
comment on column public.crm_imobiliaria.codigo_imovel_interesse is
  'Código do imóvel que originou o contato via link do site público.';
comment on column public.crm_imobiliaria.minutos_ultima_mensagem is
  'Calculado por trigger a cada atualização de ultima_mensagem.';

-- Índices
-- whatsapp já possui índice único vindo da constraint UNIQUE
create index if not exists idx_crm_status                  on public.crm_imobiliaria (status);
create index if not exists idx_crm_codigo_imovel_interesse on public.crm_imobiliaria (codigo_imovel_interesse);
create index if not exists idx_crm_created_at              on public.crm_imobiliaria (created_at desc);

drop trigger if exists trg_crm_imobiliaria_updated_at on public.crm_imobiliaria;
create trigger trg_crm_imobiliaria_updated_at
  before update on public.crm_imobiliaria
  for each row execute function public.fn_set_updated_at();
