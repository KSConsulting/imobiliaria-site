-- =====================================================================
-- ImobFlow — Etapa 1 — 04. tipos_imovel, imoveis, imoveis_fotos
-- =====================================================================

-- ---------------------------------------------------------------------
-- tipos_imovel — categorias editáveis pelo painel
-- ---------------------------------------------------------------------
create table if not exists public.tipos_imovel (
  id          uuid primary key default gen_random_uuid(),
  nome        text        not null unique,
  ativo       boolean     not null default true,
  ordem       integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tipos_imovel is
  'Categorias de imóvel. Existe como tabela e não como lista fixa porque o vocabulário muda por região (praia, interior, capital).';

create index if not exists idx_tipos_imovel_ordem on public.tipos_imovel (ordem, nome) where ativo;

drop trigger if exists trg_tipos_imovel_updated_at on public.tipos_imovel;
create trigger trg_tipos_imovel_updated_at
  before update on public.tipos_imovel
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- imoveis — cadastro dos imóveis. Alimenta site público e API.
-- ---------------------------------------------------------------------
create sequence if not exists public.seq_codigo_imovel as bigint start with 1 increment by 1;

comment on sequence public.seq_codigo_imovel is
  'Base numérica do código IMV-XXXX. Sequence nunca colide e dispensa lógica de retry.';

create table if not exists public.imoveis (
  id                      uuid primary key default gen_random_uuid(),
  codigo                  text        not null unique,
  titulo                  text        not null,
  descricao               text,
  id_tipo_imovel          uuid        not null references public.tipos_imovel (id) on delete restrict,
  finalidade              text        not null,
  status                  text        not null default 'ativo',

  -- Localização
  cep                     text,
  endereco                text,
  numero                  text,
  complemento             text,
  bairro                  text        not null,
  cidade                  text        not null,
  estado                  text        not null,

  -- Valores
  valor_venda             numeric,
  valor_aluguel           numeric,
  valor_condominio        numeric,
  valor_iptu              numeric,

  -- Características
  area_total              numeric,
  area_util               numeric,
  quartos                 integer     not null default 0,
  suites                  integer     not null default 0,
  banheiros               integer     not null default 0,
  vagas                   integer     not null default 0,
  mobiliado               boolean     not null default false,
  aceita_pet              boolean     not null default false,
  caracteristicas         jsonb,

  -- Proprietário
  proprietario_nome       text,
  proprietario_contato    text,

  -- Contadores (mantidos por trigger)
  total_visualizacoes     integer     not null default 0,
  total_cliques_whatsapp  integer     not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint imoveis_finalidade_valida
    check (finalidade in ('venda', 'locacao', 'ambos')),

  constraint imoveis_status_valido
    check (status in ('ativo', 'inativo')),

  -- Valor obrigatório conforme a finalidade
  constraint imoveis_valor_por_finalidade check (
        (finalidade <> 'venda'   or valor_venda   is not null)
    and (finalidade <> 'locacao' or valor_aluguel is not null)
    and (finalidade <> 'ambos'   or (valor_venda is not null and valor_aluguel is not null))
  )
);

comment on table public.imoveis is
  'Cadastro dos imóveis. Exclusão é DEFINITIVA (sem exclusão lógica); status = inativo apenas remove da vitrine e das consultas de disponíveis da API.';
comment on column public.imoveis.codigo is
  'Gerado automaticamente por trigger no formato IMV-XXXX a partir da sequence seq_codigo_imovel. Nunca digitado.';
comment on column public.imoveis.caracteristicas is
  'Lista livre de diferenciais em jsonb (ex: ["piscina","churrasqueira"]).';
comment on column public.imoveis.total_visualizacoes is
  'Incrementado por trigger em visualizacoes_site, deduplicado por session_id.';
comment on column public.imoveis.total_cliques_whatsapp is
  'Incrementado por trigger em visualizacoes_site, sem deduplicação.';

-- Índices
create index if not exists idx_imoveis_status        on public.imoveis (status);
create index if not exists idx_imoveis_finalidade    on public.imoveis (finalidade);
create index if not exists idx_imoveis_cidade        on public.imoveis (cidade);
create index if not exists idx_imoveis_bairro        on public.imoveis (bairro);
create index if not exists idx_imoveis_tipo          on public.imoveis (id_tipo_imovel);
create index if not exists idx_imoveis_valor_venda   on public.imoveis (valor_venda);
create index if not exists idx_imoveis_valor_aluguel on public.imoveis (valor_aluguel);
create index if not exists idx_imoveis_quartos       on public.imoveis (quartos);

drop trigger if exists trg_imoveis_updated_at on public.imoveis;
create trigger trg_imoveis_updated_at
  before update on public.imoveis
  for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- imoveis_fotos — galeria, máximo 10 por imóvel, uma única capa
-- ---------------------------------------------------------------------
create table if not exists public.imoveis_fotos (
  id          uuid primary key default gen_random_uuid(),
  id_imovel   uuid        not null references public.imoveis (id) on delete cascade,
  url         text        not null,
  ordem       integer     not null default 0,
  capa        boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.imoveis_fotos is
  'Galeria de fotos. Limite de 10 por imóvel validado por trigger; apenas uma capa por imóvel garantida por índice único parcial.';

create index if not exists idx_imoveis_fotos_imovel on public.imoveis_fotos (id_imovel, ordem);

create unique index if not exists uidx_imoveis_fotos_capa_unica
  on public.imoveis_fotos (id_imovel) where capa;
