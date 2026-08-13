-- =====================================================================
-- ImobFlow — Etapa 1 — 05. corretores, agendas, agendas_horarios,
--                          agendamentos
-- =====================================================================

-- ---------------------------------------------------------------------
-- corretores
-- ---------------------------------------------------------------------
create table if not exists public.corretores (
  id          uuid primary key default gen_random_uuid(),
  nome        text        not null,
  sobrenome   text        not null,
  whatsapp    text,
  email       text,
  creci       text,
  cor         text        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint corretores_cor_hexadecimal
    check (cor ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$')
);

comment on table  public.corretores     is 'Cadastro dos corretores. Não existe vínculo fixo entre corretor e imóvel: qualquer corretor disponível conduz qualquer visita.';
comment on column public.corretores.cor is 'Cor de destaque em hexadecimal (#RGB ou #RRGGBB), usada na Agenda do painel.';

create index if not exists idx_corretores_ativo on public.corretores (ativo);

drop trigger if exists trg_corretores_updated_at on public.corretores;
create trigger trg_corretores_updated_at
  before update on public.corretores
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- agendas — uma por corretor, criada automaticamente por trigger
-- ---------------------------------------------------------------------
create table if not exists public.agendas (
  id            uuid primary key default gen_random_uuid(),
  id_corretor   uuid        not null unique references public.corretores (id) on delete cascade,
  duracao_slot  integer     not null default 30,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint agendas_duracao_slot_positiva check (duracao_slot > 0)
);

comment on table  public.agendas              is 'Agenda individual do corretor. Criada automaticamente no cadastro do corretor.';
comment on column public.agendas.duracao_slot is 'Duração da visita em minutos. Padrão 30.';

drop trigger if exists trg_agendas_updated_at on public.agendas;
create trigger trg_agendas_updated_at
  before update on public.agendas
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- agendas_horarios — janela de atendimento por dia da semana
-- ---------------------------------------------------------------------
create table if not exists public.agendas_horarios (
  id          uuid primary key default gen_random_uuid(),
  id_agenda   uuid        not null references public.agendas (id) on delete cascade,
  dia_semana  integer     not null,
  hora_inicio time        not null,
  hora_fim    time        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),

  constraint agendas_horarios_dia_semana_valido check (dia_semana between 0 and 6),
  constraint agendas_horarios_intervalo_valido  check (hora_fim > hora_inicio)
);

comment on table  public.agendas_horarios            is 'Janela de atendimento por dia da semana. Cada corretor tem disponibilidade própria e independente.';
comment on column public.agendas_horarios.dia_semana is '0 = domingo … 6 = sábado (mesma convenção de extract(dow)).';

create index if not exists idx_agendas_horarios_agenda on public.agendas_horarios (id_agenda, dia_semana);

-- ---------------------------------------------------------------------
-- agendamentos — visitas aos imóveis
-- ---------------------------------------------------------------------
create table if not exists public.agendamentos (
  id                uuid primary key default gen_random_uuid(),
  id_lead           uuid        not null references public.crm_imobiliaria (id) on delete cascade,
  id_imovel         uuid                 references public.imoveis (id)         on delete set null,
  id_corretor       uuid        not null references public.corretores (id)      on delete restrict,
  codigo_imovel     text,
  data_hora_inicio  timestamptz not null,
  data_hora_fim     timestamptz not null,
  status            text        not null default 'agendada',
  observacoes       text,
  origem            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint agendamentos_status_valido
    check (status in ('agendada', 'realizada', 'cancelada', 'reagendada')),

  constraint agendamentos_origem_valida
    check (origem is null or origem in ('painel', 'agente_ia', 'api')),

  constraint agendamentos_intervalo_valido
    check (data_hora_fim > data_hora_inicio)
);

comment on table public.agendamentos is
  'Visitas aos imóveis, em blocos de 30 minutos.';
comment on column public.agendamentos.codigo_imovel is
  'Cópia do código do imóvel no momento do agendamento. Preserva o histórico da visita mesmo depois do imóvel sair do banco (exclusão é definitiva).';

create index if not exists idx_agendamentos_corretor  on public.agendamentos (id_corretor);
create index if not exists idx_agendamentos_inicio    on public.agendamentos (data_hora_inicio);
create index if not exists idx_agendamentos_status    on public.agendamentos (status);
create index if not exists idx_agendamentos_lead      on public.agendamentos (id_lead);

drop trigger if exists trg_agendamentos_updated_at on public.agendamentos;
create trigger trg_agendamentos_updated_at
  before update on public.agendamentos
  for each row execute function public.fn_set_updated_at();
