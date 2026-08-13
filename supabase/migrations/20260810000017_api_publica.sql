-- =====================================================================
-- ImobFlow — Etapa 9 — 17. Apoio à API pública
-- =====================================================================
-- Três coisas que a Edge Function precisa e que ficam melhor no banco:
--
--  1. **Autenticar em uma ida só.** Validar o token, marcar `ultimo_uso`
--     e contar a requisição são três escritas conceituais. Feitas em
--     três chamadas separadas, viram três viagens de rede em TODA
--     requisição da API — o agente de IA faz várias por conversa.
--
--  2. **Contar requisições onde o contador sobrevive.** Edge Function é
--     efêmera e roda em várias instâncias ao mesmo tempo. Um contador em
--     memória zera a cada isolate novo e não enxerga o que as outras
--     instâncias estão fazendo — ou seja, não limita nada. O contador
--     precisa ser único e compartilhado, e o banco já é os dois.
--
--  3. **Classificar as ações da API na trilha.** `fn_log_categoria`
--     ganha a categoria `api`, senão toda chamada do agente cai em
--     "outras" e a aba de Logs fica impossível de recortar justamente
--     quando o volume passa a ser majoritariamente dele.
-- =====================================================================

-- ---------------------------------------------------------------------
-- api_uso — contador de requisições por token e janela
-- ---------------------------------------------------------------------
-- Uma linha por (token, minuto). Não é um log de chamadas: a trilha
-- disso é `logs_sistema`. Aqui é só o contador, e as linhas velhas são
-- apagadas — guardar histórico de contagem por minuto para sempre seria
-- pagar armazenamento por um dado que ninguém consulta.
-- ---------------------------------------------------------------------
create table if not exists public.api_uso (
  id_token  uuid        not null references public.api_tokens (id) on delete cascade,
  janela    timestamptz not null,
  total     integer     not null default 0,
  primary key (id_token, janela)
);

comment on table public.api_uso is
  'Contador de requisições da API por token e janela de tempo. Efêmero: linhas com mais de 1 hora são descartadas.';

alter table public.api_uso enable row level security;

-- Nenhuma política, de propósito: só o `service_role` (que ignora RLS)
-- toca nesta tabela, e ele só existe dentro da Edge Function. O painel
-- não tem o que fazer aqui.
revoke all on public.api_uso from anon, authenticated;

-- ---------------------------------------------------------------------
-- fn_api_autenticar — valida, conta e libera, em uma chamada
-- ---------------------------------------------------------------------
-- Devolve ZERO LINHAS quando o token não existe ou está revogado. Quem
-- chama distingue os dois casos pela ausência de resultado, e a Edge
-- Function responde 401 sem dizer qual dos dois é — informar "existe mas
-- está revogado" confirmaria a validade do valor para quem o obteve
-- indevidamente.
--
-- `ultimo_uso` só é atualizado quando a chamada é ACEITA. Um agente em
-- loop sendo barrado pelo limite não deve manter o token parecendo em
-- uso saudável na tela de Configurações.
-- ---------------------------------------------------------------------
create or replace function public.fn_api_autenticar(
  p_token           text,
  p_limite          integer default 120,
  p_janela_segundos integer default 60
)
returns table (
  id_token    uuid,
  nome        text,
  permitido   boolean,
  restante    integer,
  reinicia_em timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- Os nomes do `returns table` viram variáveis no corpo da função, e
-- `id_token` é também o nome de uma coluna de `api_uso`. Sem esta
-- diretiva, o `on conflict (id_token, janela)` não sabe a qual dos dois
-- se refere e o Postgres recusa com 42702 — mas só no caminho do token
-- VÁLIDO, que é o único que chega ao insert. Ou seja: a autenticação
-- rejeitaria corretamente todo token inválido e falharia justamente com
-- os válidos.
#variable_conflict use_column
declare
  v_id     uuid;
  v_nome   text;
  v_janela timestamptz;
  v_total  integer;
begin
  select t.id, t.nome
    into v_id, v_nome
    from public.api_tokens t
   where t.token = p_token
     and t.ativo
   limit 1;

  if v_id is null then
    return;
  end if;

  -- Janela fixa alinhada ao relógio, não deslizante: o contador é uma
  -- linha por minuto, e uma janela deslizante exigiria guardar cada
  -- requisição individualmente para saber o que já saiu do intervalo.
  v_janela := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_janela_segundos, 1)) * greatest(p_janela_segundos, 1)
  );

  insert into public.api_uso as u (id_token, janela, total)
  values (v_id, v_janela, 1)
  on conflict (id_token, janela) do update set total = u.total + 1
  returning u.total into v_total;

  if v_total <= p_limite then
    update public.api_tokens set ultimo_uso = now() where id = v_id;
  end if;

  -- Limpeza só quando a janela é nova — uma vez por minuto por token, e
  -- não a cada requisição.
  if v_total = 1 then
    delete from public.api_uso where janela < now() - interval '1 hour';
  end if;

  return query
    select v_id,
           v_nome,
           v_total <= p_limite,
           greatest(p_limite - v_total, 0),
           v_janela + make_interval(secs => greatest(p_janela_segundos, 1));
end;
$$;

comment on function public.fn_api_autenticar(text, integer, integer) is
  'Valida o token da API, conta a requisição na janela e marca ultimo_uso. Zero linhas = token inexistente ou revogado.';

-- ---------------------------------------------------------------------
-- fn_log_categoria — agora conhece as ações da API
-- ---------------------------------------------------------------------
-- Substitui a definição da migration …016. O ramo `api` vem PRIMEIRO
-- porque `api_visita_agendada` também casaria com o padrão de criação, e
-- a origem é a informação mais útil para recortar a trilha: quem abre a
-- aba de Logs quer separar "o que a equipe fez" de "o que o agente fez".
-- ---------------------------------------------------------------------
create or replace function public.fn_log_categoria(p_acao text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_acao like 'api\_%'                                    then 'api'
    when p_acao like '%\_criad%'  or p_acao like '%\_adicionad%' then 'criacao'
    when p_acao like '%\_atualizad%' or p_acao like '%reorden%'  then 'edicao'
    when p_acao like '%\_excluid%' or p_acao like '%\_removid%'  then 'exclusao'
    when p_acao like '%\_ativad%'  or p_acao like '%\_desativad%'
      or p_acao like '%\_reativad%' or p_acao like '%\_revogad%'
      or p_acao like '%\_cancelad%'                              then 'status'
    when p_acao like '%\_realizad%'                              then 'sessao'
    else 'outro'
  end
$$;

comment on function public.fn_log_categoria(text) is
  'Categoria da ação a partir do prefixo/sufixo do nome. Regra única, usada pelo filtro e pela exibição. Redefinida na …017 para conhecer as ações da API.';

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
-- `fn_api_autenticar` é SECURITY DEFINER e escreve em `api_tokens`:
-- ninguém além do `service_role` da Edge Function tem o que fazer com
-- ela. `fn_log_categoria` volta a ser executável pelo painel, como a
-- …016 já a deixava — o `create or replace` reseta os privilégios.
-- ---------------------------------------------------------------------
do $$
begin
  execute 'revoke all on function public.fn_api_autenticar(text, integer, integer) from public, anon, authenticated';
  execute 'grant execute on function public.fn_api_autenticar(text, integer, integer) to service_role';

  execute 'revoke all on function public.fn_log_categoria(text) from public, anon';
  execute 'grant execute on function public.fn_log_categoria(text) to authenticated, service_role';
end;
$$;
