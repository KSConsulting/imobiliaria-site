-- =====================================================================
-- ImobFlow — Etapa 8 — 16. Consulta da trilha de auditoria
-- =====================================================================
-- A aba de Logs precisa de três coisas que o PostgREST sozinho não
-- entrega bem:
--
--  1. Busca livre sobre o CONTEÚDO do log. Quem digita "IMV-0042" está
--     atrás de um imóvel que provavelmente não existe mais — a exclusão
--     de imóvel é definitiva, e o código só sobrevive dentro de
--     `dados_anteriores`. Sem varrer o jsonb, a única rastreabilidade
--     que resta de uma exclusão fica inalcançável justamente no caso em
--     que ela é a única coisa que restou.
--
--  2. A categoria da ação (criação, edição, exclusão, ativação). Ela é
--     derivada do nome da ação, e a regra precisa viver em UM lugar só:
--     se o filtro e o rótulo discordarem, o usuário filtra por
--     "exclusão" e recebe uma lista que não bate com o que pediu.
--
--  3. O total real junto da página. Sem ele a paginação não sabe quantas
--     páginas existem; com uma segunda consulta de contagem, os dois
--     números saem de sincronia no dia em que alguém mudar um filtro
--     num lugar e esquecer do outro.
--
-- Convenções, as mesmas da migration …015:
--   • Período meio-aberto: `p_inicio` inclusivo, `p_fim` exclusivo.
--   • SECURITY INVOKER — o RLS de `logs_sistema` continua valendo. A
--     política de leitura é de autenticado, e `anon` não enxerga nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_log_categoria — a regra única de classificação
-- ---------------------------------------------------------------------
-- A convenção de nome das ações é `entidade_acao`, no passado (ver
-- src/lib/logs.ts). A categoria sai do sufixo, e não de uma tabela de
-- correspondência: ação nova segue a convenção e é classificada sozinha,
-- em vez de cair silenciosamente fora de todos os filtros.
--
-- Cuidado com a ordem: "desativado" NÃO casa com '%\_ativado%' porque o
-- padrão exige o underline logo antes — é por isso que as duas convivem
-- no mesmo ramo sem se atrapalhar.
-- ---------------------------------------------------------------------
create or replace function public.fn_log_categoria(p_acao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_acao like '%\_criad%'  or p_acao like '%\_adicionad%' then 'criacao'
    when p_acao like '%\_atualizad%' or p_acao like '%reorden%'  then 'edicao'
    when p_acao like '%\_excluid%' or p_acao like '%\_removid%'  then 'exclusao'
    when p_acao like '%\_ativad%'  or p_acao like '%\_desativad%'
      or p_acao like '%\_reativad%' or p_acao like '%\_revogad%'
      or p_acao like '%\_cancelad%'                              then 'status'
    -- login e logout: nem criação, nem edição. Sem categoria própria
    -- eles caem em "outro" e passam a ser a maioria da lista, já que
    -- todo dia de trabalho começa com um.
    when p_acao like '%\_realizad%'                              then 'sessao'
    else 'outro'
  end
$$;

comment on function public.fn_log_categoria(text) is
  'Categoria da ação a partir do sufixo do nome. Regra única, usada pelo filtro e pela exibição.';

-- ---------------------------------------------------------------------
-- fn_logs_listar — a página e o total, numa consulta só
-- ---------------------------------------------------------------------
-- A busca usa `strpos` sobre o texto em minúsculas, e não `ilike`: o
-- termo vem digitado pelo usuário, e um "%" ou "_" perdido no meio de
-- um código viraria curinga sem que ninguém entendesse por que a lista
-- cresceu.
--
-- Varrer `dados_*::text` é varredura sequencial mesmo — assumida de
-- propósito. A alternativa (índice GIN sobre o jsonb) custaria escrita
-- em toda ação registrada do sistema para acelerar uma tela que se
-- consulta esporadicamente, quase sempre já recortada por período.
-- ---------------------------------------------------------------------
create or replace function public.fn_logs_listar(
  p_busca        text        default null,
  p_categoria    text        default null,
  p_tabela       text        default null,
  p_usuario      uuid        default null,
  p_inicio       timestamptz default null,
  p_fim          timestamptz default null,
  p_limite       integer     default 25,
  p_deslocamento integer     default 0
)
returns table (
  id               uuid,
  created_at       timestamptz,
  acao             text,
  categoria        text,
  tabela           text,
  id_registro      text,
  dados_anteriores jsonb,
  dados_novos      jsonb,
  id_usuario       uuid,
  usuario_nome     text,
  usuario_email    text,
  total            bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with termo as (
    select nullif(lower(btrim(coalesce(p_busca, ''))), '') as t
  ),
  filtrados as (
    select l.id, l.created_at, l.acao, l.tabela, l.id_registro,
           l.dados_anteriores, l.dados_novos, l.id_usuario,
           u.nome as usuario_nome, u.email as usuario_email
      from public.logs_sistema l
      left join public.usuarios u on u.id = l.id_usuario
     cross join termo
     where (p_categoria is null or public.fn_log_categoria(l.acao) = p_categoria)
       and (p_tabela    is null or l.tabela      = p_tabela)
       and (p_usuario   is null or l.id_usuario  = p_usuario)
       and (p_inicio    is null or l.created_at >= p_inicio)
       and (p_fim       is null or l.created_at <  p_fim)
       and (
         termo.t is null
         or strpos(lower(l.acao), termo.t) > 0
         or strpos(lower(coalesce(l.tabela, '')), termo.t) > 0
         or strpos(lower(coalesce(u.nome, '')), termo.t) > 0
         or strpos(lower(coalesce(l.dados_anteriores::text, '')), termo.t) > 0
         or strpos(lower(coalesce(l.dados_novos::text, '')), termo.t) > 0
       )
  )
  select f.id,
         f.created_at,
         f.acao,
         public.fn_log_categoria(f.acao) as categoria,
         f.tabela,
         f.id_registro,
         f.dados_anteriores,
         f.dados_novos,
         f.id_usuario,
         f.usuario_nome,
         f.usuario_email,
         count(*) over () as total
    from filtrados f
   order by f.created_at desc, f.id desc
   limit  greatest(coalesce(p_limite, 25), 1)
  offset greatest(coalesce(p_deslocamento, 0), 0)
$$;

comment on function public.fn_logs_listar(text, text, text, uuid, timestamptz, timestamptz, integer, integer) is
  'Página da trilha de auditoria com o total real da consulta na coluna total. Período meio-aberto.';

-- ---------------------------------------------------------------------
-- fn_logs_filtros — só o que existe
-- ---------------------------------------------------------------------
-- Os seletores da tela são montados a partir daqui, e não de uma lista
-- fixa de tabelas do sistema. Oferecer "corretores" num sistema que
-- nunca cadastrou corretor produz um filtro que só sabe devolver vazio
-- — e vazio, na tela, é indistinguível de erro.
-- ---------------------------------------------------------------------
create or replace function public.fn_logs_filtros()
returns table (tabelas text[], categorias text[], usuarios jsonb)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (select coalesce(array_agg(distinct s.t order by s.t), '{}'::text[])
       from (select l.tabela as t from public.logs_sistema l where l.tabela is not null) s),
    (select coalesce(array_agg(distinct s.c order by s.c), '{}'::text[])
       from (select public.fn_log_categoria(l.acao) as c from public.logs_sistema l) s),
    (select coalesce(
              jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome) order by u.nome),
              '[]'::jsonb)
       from public.usuarios u
      where exists (select 1 from public.logs_sistema l where l.id_usuario = u.id))
$$;

comment on function public.fn_logs_filtros() is
  'Valores que de fato aparecem em logs_sistema, para montar os seletores da tela sem opções mortas.';

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
-- Mesmo padrão da migration …015: nada para `anon`, execução apenas
-- para autenticado. O RLS já protegeria as linhas, mas uma função
-- executável por anônimo é superfície exposta sem motivo.
-- ---------------------------------------------------------------------
do $$
declare
  v_func text;
begin
  for v_func in
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('fn_log_categoria', 'fn_logs_listar', 'fn_logs_filtros')
  loop
    execute format('revoke all on function %s from public, anon', v_func);
    execute format('grant execute on function %s to authenticated', v_func);
  end loop;
end;
$$;
