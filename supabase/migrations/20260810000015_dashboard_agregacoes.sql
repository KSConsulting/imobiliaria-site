-- =====================================================================
-- ImobFlow — Etapa 7 — Agregações do Dashboard
-- =====================================================================
-- Toda contagem do Dashboard acontece AQUI, e não no frontend.
--
-- O motivo é de escala, e ele chega rápido: `visualizacoes_site` recebe
-- uma linha por página vista do site público. Trazer isso para o
-- navegador para somar significaria baixar meses de tráfego a cada
-- abertura do painel — a página funcionaria bem na demonstração e
-- travaria no terceiro mês do cliente.
--
-- ---------------------------------------------------------------------
-- Convenções que valem para todas as funções deste arquivo
-- ---------------------------------------------------------------------
--
-- 1. PERÍODO SEMIABERTO: `p_inicio` é inclusivo e `p_fim` é exclusivo.
--    Quem chama passa como `p_fim` a meia-noite do dia SEGUINTE ao
--    último dia desejado. Assim não existe o `23:59:59.999`, que perde
--    eventos gravados no último milissegundo do dia.
--
-- 2. FUSO DA IMOBILIÁRIA: o agrupamento por dia usa o fuso de
--    `configuracoes.fuso_horario`, nunca UTC. Uma visita às 22h de
--    segunda em São Paulo é terça em UTC — agrupar em UTC jogaria o
--    movimento da noite para o dia seguinte e o gráfico de dias da
--    semana, que existe para dimensionar equipe, apontaria o dia errado.
--
-- 3. SECURITY INVOKER: as funções rodam com o papel de quem chama e o
--    RLS continua valendo. Não há escalonamento de privilégio aqui —
--    `authenticated` já enxerga estas tabelas. O EXECUTE é revogado de
--    `public` e `anon` no fim do arquivo, seguindo a migration …012.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: fuso configurado, legível pelo papel `authenticated`.
--
-- `fn_fuso_horario()` já existe, mas é SECURITY DEFINER e teve o EXECUTE
-- revogado na migration …012 — funções SECURITY INVOKER não conseguem
-- chamá-la. Esta lê a mesma coluna pelo caminho normal do RLS.
-- ---------------------------------------------------------------------
create or replace function public.fn_fuso_painel()
returns text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((select fuso_horario from public.configuracoes limit 1), 'America/Sao_Paulo');
$$;

comment on function public.fn_fuso_painel() is
  'Fuso da imobiliária para as agregações do Dashboard. Versão SECURITY INVOKER de fn_fuso_horario.';

-- =====================================================================
-- 1. Indicadores da faixa fixa
-- =====================================================================
-- Devolve o período e o anterior na MESMA chamada. Duas idas ao banco
-- para montar um cartão com a seta de variação seria dobrar a latência
-- justamente no bloco que precisa aparecer primeiro.
--
-- O período anterior é calculado por quem chama, e não aqui: "últimos 30
-- dias" tem como anterior os 30 dias imediatamente antes, mas "este mês"
-- tem como anterior o mês passado, que pode ter 28 ou 31 dias. Essa
-- semântica vive junto das opções do seletor, no frontend.
-- =====================================================================
create or replace function public.fn_dashboard_indicadores(
  p_inicio           timestamptz,
  p_fim              timestamptz,
  p_inicio_anterior  timestamptz,
  p_fim_anterior     timestamptz
)
returns table (
  leads_novos              bigint,
  leads_novos_anterior     bigint,
  visitas                  bigint,
  visitas_anterior         bigint,
  visitas_site             bigint,
  visitas_site_anterior    bigint,
  imoveis_ativos           bigint,
  imoveis_venda            bigint,
  imoveis_locacao          bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.crm_imobiliaria c
      where c.created_at >= p_inicio and c.created_at < p_fim),
    (select count(*) from public.crm_imobiliaria c
      where c.created_at >= p_inicio_anterior and c.created_at < p_fim_anterior),

    -- Visitas contadas pela data em que ACONTECEM (`data_hora_inicio`),
    -- não pela data em que foram cadastradas. É o número que o dono lê
    -- como "movimento do período". Canceladas não entram: visita
    -- cancelada não é visita.
    (select count(*) from public.agendamentos a
      where a.data_hora_inicio >= p_inicio and a.data_hora_inicio < p_fim
        and a.status <> 'cancelada'),
    (select count(*) from public.agendamentos a
      where a.data_hora_inicio >= p_inicio_anterior and a.data_hora_inicio < p_fim_anterior
        and a.status <> 'cancelada'),

    (select count(*) from public.visualizacoes_site v
      where v.tipo_evento = 'visualizacao'
        and v.created_at >= p_inicio and v.created_at < p_fim),
    (select count(*) from public.visualizacoes_site v
      where v.tipo_evento = 'visualizacao'
        and v.created_at >= p_inicio_anterior and v.created_at < p_fim_anterior),

    -- Estoque é retrato do AGORA, não do período. Por isso o cartão
    -- exibe a divisão venda/locação no lugar da seta de variação:
    -- comparar um número atual com "o período anterior" não faz sentido.
    (select count(*) from public.imoveis i where i.status = 'ativo'),
    (select count(*) from public.imoveis i
      where i.status = 'ativo' and i.finalidade in ('venda', 'ambos')),
    (select count(*) from public.imoveis i
      where i.status = 'ativo' and i.finalidade in ('locacao', 'ambos'));
$$;

comment on function public.fn_dashboard_indicadores(timestamptz, timestamptz, timestamptz, timestamptz) is
  'Etapa 7 — Os quatro indicadores da faixa fixa do Dashboard, com o período anterior na mesma chamada para a variação percentual.';

-- =====================================================================
-- 2. Ranking de imóveis por visualização ou clique
-- =====================================================================
-- Consulta `visualizacoes_site` por período, e NÃO os contadores
-- `imoveis.total_visualizacoes` / `total_cliques_whatsapp`: aqueles são
-- acumulados desde sempre e não sabem responder "nos últimos 30 dias".
--
-- Devolve as duas contagens sempre, independente da ordenação, porque a
-- taxa de conversão (cliques ÷ visualizações) precisa das duas — e é o
-- número mais acionável da tela: muito visto com pouco clique é problema
-- de preço ou de foto; pouco visto com muito clique merece destaque.
--
-- A junção com `imoveis` é interna de propósito. `visualizacoes_site.
-- id_imovel` é ON DELETE SET NULL, então o tráfego de um imóvel excluído
-- sobrevive sem vínculo. Ele fica fora do ranking porque o ranking existe
-- para levar a uma ação no imóvel, e não há imóvel para onde ir. O
-- volume permanece contado no total geral e na linha agregada de
-- páginas de imóvel.
-- =====================================================================
create or replace function public.fn_dashboard_ranking_imoveis(
  p_inicio  timestamptz,
  p_fim     timestamptz,
  p_evento  text default 'visualizacao',
  p_limite  integer default 10
)
returns table (
  id_imovel       uuid,
  codigo          text,
  titulo          text,
  bairro          text,
  cidade          text,
  url_capa        text,
  visualizacoes   bigint,
  cliques         bigint,
  conversao       numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with eventos as (
    select
      v.id_imovel,
      count(*) filter (where v.tipo_evento = 'visualizacao')    as visualizacoes,
      count(*) filter (where v.tipo_evento = 'clique_whatsapp') as cliques
    from public.visualizacoes_site v
    where v.id_imovel is not null
      and v.created_at >= p_inicio
      and v.created_at <  p_fim
    group by v.id_imovel
  )
  select
    i.id,
    i.codigo,
    i.titulo,
    i.bairro,
    i.cidade,
    (
      -- Capa: a marcada como capa; sem nenhuma marcada, a primeira da
      -- ordem. Mesma regra da vitrine e da listagem do painel.
      select f.url
        from public.imoveis_fotos f
       where f.id_imovel = i.id
       order by f.capa desc, f.ordem asc
       limit 1
    ),
    e.visualizacoes,
    e.cliques,
    case when e.visualizacoes > 0
         then round((e.cliques::numeric / e.visualizacoes) * 100, 1)
         else null
    end
  from eventos e
  join public.imoveis i on i.id = e.id_imovel
  where case when p_evento = 'clique_whatsapp'
             then e.cliques > 0
             else e.visualizacoes > 0
        end
  order by case when p_evento = 'clique_whatsapp' then e.cliques else e.visualizacoes end desc,
           i.created_at desc
  limit greatest(p_limite, 1);
$$;

comment on function public.fn_dashboard_ranking_imoveis(timestamptz, timestamptz, text, integer) is
  'Etapa 7 — Ranking de imóveis por visualização ou clique no período, com a taxa de conversão. Lê visualizacoes_site, não os contadores acumulados.';

-- =====================================================================
-- 3. Páginas mais acessadas
-- =====================================================================
-- As páginas de imóvel individual são somadas em UMA linha.
--
-- Sem isso a lista vira uma enumeração de códigos — `/imovel/IMV-0042`,
-- `/imovel/IMV-0043`, … — que empurra `/` e `/imoveis` para o fim e
-- destrói exatamente o que a lista deveria mostrar: o comportamento
-- geral de navegação. O detalhe por imóvel já existe, e melhor, nos dois
-- rankings acima.
-- =====================================================================
create or replace function public.fn_dashboard_paginas(
  p_inicio  timestamptz,
  p_fim     timestamptz
)
returns table (
  pagina    text,
  acessos   bigint,
  agregada  boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    case when v.pagina like '/imovel/%' then '/imovel/…' else v.pagina end,
    count(*),
    bool_or(v.pagina like '/imovel/%')
  from public.visualizacoes_site v
  where v.tipo_evento = 'visualizacao'
    and v.created_at >= p_inicio
    and v.created_at <  p_fim
  group by 1
  order by 2 desc;
$$;

comment on function public.fn_dashboard_paginas(timestamptz, timestamptz) is
  'Etapa 7 — Páginas mais acessadas no período. As páginas de imóvel individual são somadas numa linha só.';

-- =====================================================================
-- 4. Série diária de leads, atendimentos e visitas
-- =====================================================================
-- Uma linha por dia do período, INCLUSIVE os dias sem nenhum evento.
--
-- O `generate_series` com `left join` é o ponto central desta função: um
-- gráfico que pula os dias vazios mente sobre a forma da curva. Três
-- leads em três dias seguidos e três leads em três dias espalhados por
-- um mês desenhariam a mesma linha, e o dono leria constância onde há
-- um pico isolado.
-- =====================================================================
create or replace function public.fn_dashboard_serie_diaria(
  p_inicio  timestamptz,
  p_fim     timestamptz
)
returns table (
  dia            date,
  leads          bigint,
  atendimentos   bigint,
  visitas        bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with tz as (select public.fn_fuso_painel() as fuso),
  dias as (
    select generate_series(
      ((p_inicio at time zone (select fuso from tz))::date),
      ((p_fim    at time zone (select fuso from tz))::date - 1),
      interval '1 day'
    )::date as dia
  ),
  leads as (
    select (c.created_at at time zone (select fuso from tz))::date as dia, count(*) as total
      from public.crm_imobiliaria c
     where c.created_at >= p_inicio and c.created_at < p_fim
     group by 1
  ),
  -- Atendimento do agente de IA: contado por `inicio_atendimento`, que é
  -- quando a conversa no WhatsApp começou. Lead cadastrado à mão nunca
  -- tem esse campo e, corretamente, não entra nesta contagem.
  atendimentos as (
    select (c.inicio_atendimento at time zone (select fuso from tz))::date as dia, count(*) as total
      from public.crm_imobiliaria c
     where c.inicio_atendimento >= p_inicio and c.inicio_atendimento < p_fim
     group by 1
  ),
  visitas as (
    select (a.data_hora_inicio at time zone (select fuso from tz))::date as dia, count(*) as total
      from public.agendamentos a
     where a.data_hora_inicio >= p_inicio and a.data_hora_inicio < p_fim
       and a.status <> 'cancelada'
     group by 1
  )
  select
    d.dia,
    coalesce(l.total, 0),
    coalesce(t.total, 0),
    coalesce(v.total, 0)
  from dias d
  left join leads        l on l.dia = d.dia
  left join atendimentos t on t.dia = d.dia
  left join visitas      v on v.dia = d.dia
  order by d.dia;
$$;

comment on function public.fn_dashboard_serie_diaria(timestamptz, timestamptz) is
  'Etapa 7 — Leads, atendimentos do agente e visitas por dia do período, no fuso da imobiliária. Dias sem evento vêm com zero.';

-- =====================================================================
-- 5. Distribuição por dia da semana
-- =====================================================================
-- Serve para dimensionar equipe: em que dias o WhatsApp toca mais e em
-- que dias as visitas se concentram.
--
-- Os sete dias vêm sempre, mesmo zerados — a leitura aqui é comparativa,
-- e uma barra ausente some da comparação em vez de mostrar que aquele
-- dia é o vazio.
-- =====================================================================
create or replace function public.fn_dashboard_dia_semana(
  p_inicio  timestamptz,
  p_fim     timestamptz
)
returns table (
  dia_semana    integer,
  atendimentos  bigint,
  visitas       bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with tz as (select public.fn_fuso_painel() as fuso),
  -- 0 = domingo, mesma convenção de `agendas_horarios.dia_semana` e do
  -- array NOMES_DIAS em src/lib/datas.ts.
  semana as (select generate_series(0, 6) as dia_semana),
  atendimentos as (
    select extract(dow from (c.inicio_atendimento at time zone (select fuso from tz)))::integer as dia_semana,
           count(*) as total
      from public.crm_imobiliaria c
     where c.inicio_atendimento >= p_inicio and c.inicio_atendimento < p_fim
     group by 1
  ),
  visitas as (
    select extract(dow from (a.data_hora_inicio at time zone (select fuso from tz)))::integer as dia_semana,
           count(*) as total
      from public.agendamentos a
     where a.data_hora_inicio >= p_inicio and a.data_hora_inicio < p_fim
       and a.status <> 'cancelada'
     group by 1
  )
  select s.dia_semana, coalesce(t.total, 0), coalesce(v.total, 0)
    from semana s
    left join atendimentos t on t.dia_semana = s.dia_semana
    left join visitas      v on v.dia_semana = s.dia_semana
   order by s.dia_semana;
$$;

comment on function public.fn_dashboard_dia_semana(timestamptz, timestamptz) is
  'Etapa 7 — Concentração de atendimentos e visitas por dia da semana, no fuso da imobiliária. Os sete dias vêm sempre.';

-- =====================================================================
-- 6. Leads por etapa do funil
-- =====================================================================
-- Retrato do AGORA: quantos leads estão parados em cada etapa neste
-- momento. Não é do período — um lead que entrou em janeiro e continua
-- em `conversando` é justamente o que precisa aparecer.
-- =====================================================================
create or replace function public.fn_dashboard_leads_por_status()
returns table (
  status  text,
  total   bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select c.status, count(*)
    from public.crm_imobiliaria c
   group by c.status
   order by count(*) desc;
$$;

comment on function public.fn_dashboard_leads_por_status() is
  'Etapa 7 — Quantidade atual de leads em cada etapa do funil. Estado presente, não recorte de período.';

-- =====================================================================
-- 7. Resumo de estoque
-- =====================================================================
-- Números atuais. A interface precisa deixar isso visualmente claro,
-- porque estão na mesma tela que os indicadores de período.
-- =====================================================================
create or replace function public.fn_dashboard_estoque()
returns table (
  ativos      bigint,
  inativos    bigint,
  venda       bigint,
  locacao     bigint,
  ambos       bigint,
  sem_foto    bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where i.status = 'ativo'),
    count(*) filter (where i.status = 'inativo'),
    count(*) filter (where i.status = 'ativo' and i.finalidade = 'venda'),
    count(*) filter (where i.status = 'ativo' and i.finalidade = 'locacao'),
    count(*) filter (where i.status = 'ativo' and i.finalidade = 'ambos'),
    -- Imóvel ativo sem foto nenhuma é um problema silencioso: aparece na
    -- vitrine como um retângulo cinza e quase nunca é clicado.
    count(*) filter (
      where i.status = 'ativo'
        and not exists (select 1 from public.imoveis_fotos f where f.id_imovel = i.id)
    )
  from public.imoveis i;
$$;

comment on function public.fn_dashboard_estoque() is
  'Etapa 7 — Retrato atual do estoque: ativos, inativos, divisão por finalidade e ativos sem foto.';

-- =====================================================================
-- 8. Estoque por tipo de imóvel
-- =====================================================================
create or replace function public.fn_dashboard_estoque_por_tipo()
returns table (
  tipo    text,
  total   bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select t.nome, count(i.id)
    from public.imoveis i
    join public.tipos_imovel t on t.id = i.id_tipo_imovel
   where i.status = 'ativo'
   group by t.nome
   order by count(i.id) desc, t.nome;
$$;

comment on function public.fn_dashboard_estoque_por_tipo() is
  'Etapa 7 — Divisão dos imóveis ativos por tipo, para o gráfico do resumo de estoque.';

-- =====================================================================
-- 9. Existe algum dado no sistema?
-- =====================================================================
-- Alimenta o estado inicial do Dashboard. Sistema recém-implantado não
-- deve exibir uma página inteira de zeros: isso parece defeito. Melhor
-- dizer que ainda não há o que medir e apontar o primeiro passo.
--
-- Uma chamada só, com `exists` em cada tabela — barata mesmo com a base
-- cheia, porque nenhuma delas precisa varrer nada além da primeira
-- linha encontrada.
-- =====================================================================
create or replace function public.fn_dashboard_tem_dados()
returns table (
  tem_imoveis        boolean,
  tem_leads          boolean,
  tem_visitas        boolean,
  tem_trafego        boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.imoveis),
    exists (select 1 from public.crm_imobiliaria),
    exists (select 1 from public.agendamentos),
    exists (select 1 from public.visualizacoes_site);
$$;

comment on function public.fn_dashboard_tem_dados() is
  'Etapa 7 — Se existe qualquer dado no sistema, para escolher entre o Dashboard e o estado de implantação recente.';

-- =====================================================================
-- Privilégios
-- =====================================================================
-- Mesma política da migration …012: o Postgres concede EXECUTE a PUBLIC
-- por padrão, e isso expõe cada função em /rest/v1/rpc/<nome>. Estas
-- respondem sobre leads, tráfego e agenda — nada que deva estar ao
-- alcance do visitante anônimo do site.
--
-- Sendo SECURITY INVOKER, o RLS já barraria o `anon` (que não tem
-- política de leitura em `crm_imobiliaria`). Revogar mesmo assim: uma
-- função que devolve zeros para quem não deveria nem poder perguntar
-- ainda confirma que o endpoint existe.
-- =====================================================================
do $$
declare
  v_func text;
begin
  for v_func in
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'fn_dashboard_%' or p.proname = 'fn_fuso_painel')
  loop
    execute format('revoke all on function %s from public, anon', v_func);
    execute format('grant execute on function %s to authenticated', v_func);
  end loop;
end;
$$;
