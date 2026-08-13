-- =====================================================================
-- ImobFlow — Etapa 1 — 06. visualizacoes_site
-- =====================================================================

create table if not exists public.visualizacoes_site (
  id             uuid primary key default gen_random_uuid(),
  pagina         text        not null,
  id_imovel      uuid references public.imoveis (id) on delete set null,
  codigo_imovel  text,
  tipo_evento    text        not null,
  referrer       text,
  user_agent     text,
  session_id     text,
  created_at     timestamptz not null default now(),

  constraint visualizacoes_site_tipo_evento_valido
    check (tipo_evento in ('visualizacao', 'clique_whatsapp'))
);

comment on table public.visualizacoes_site is
  'Rastreamento próprio de tráfego do site público. Não depende de ferramenta externa e alimenta os contadores em imoveis.';
comment on column public.visualizacoes_site.session_id is
  'Identificador de sessão do navegador. Base da deduplicação de visualizações.';

create index if not exists idx_visualizacoes_created_at on public.visualizacoes_site (created_at desc);
create index if not exists idx_visualizacoes_imovel     on public.visualizacoes_site (id_imovel);
create index if not exists idx_visualizacoes_tipo       on public.visualizacoes_site (tipo_evento);
create index if not exists idx_visualizacoes_pagina     on public.visualizacoes_site (pagina);
create index if not exists idx_visualizacoes_dedup      on public.visualizacoes_site (session_id, id_imovel, tipo_evento);
