-- =====================================================================
-- ImobFlow — 23. horario_funcionamento (atendimento ao público)
-- =====================================================================
--
-- O horário em que a imobiliária atende, por dia da semana, para o
-- agente informar no WhatsApp e para o site exibir.
--
-- **Não é a janela de visitas, e a distinção é o ponto todo.** Quem
-- decide se um agendamento cabe continua sendo `agendas_horarios`, a
-- janela de cada corretor, validada pelos triggers 4 e 5. Este campo é
-- declarativo: nada é agendado por ele e nada é recusado por ele.
--
-- Os dois convivem porque são diferentes de verdade — uma imobiliária
-- abre das 9h às 18h e pode fazer visitas só das 10h às 16h. O risco é
-- declarar mais largo do que os corretores cobrem, prometendo ao cliente
-- um horário que o banco vai recusar. Por isso a tela de Configurações
-- compara os dois e avisa. Ver CLAUDE.md.
--
-- **Formato**: array de objetos, um por dia, na convenção de
-- `agendas_horarios` (0 = domingo).
--
--   [{"dia": 1, "aberto": true, "abre": "09:00", "fecha": "18:00"}, …]
--
-- `null` na coluna significa não configurado, e é o mesmo que nenhum dia
-- aberto: a linha não sai na view nem no site.
-- =====================================================================

alter table public.configuracoes
  add column if not exists horario_funcionamento jsonb;

comment on column public.configuracoes.horario_funcionamento is
  'Horário de atendimento ao público, por dia da semana, em array jsonb (0 = domingo). Declarativo: NÃO valida agendamento, que é de agendas_horarios. Nulo ou sem nenhum dia aberto significa não informado.';

-- Guarda só a forma, não o conteúdo. A coluna é escrita apenas pelo
-- painel; o CHECK existe para o caso de alguém tocá-la pelo SQL editor e
-- transformar a view num erro de execução em vez de numa linha a menos.
alter table public.configuracoes
  drop constraint if exists configuracoes_horario_funcionamento_array;

alter table public.configuracoes
  add constraint configuracoes_horario_funcionamento_array
  check (horario_funcionamento is null or jsonb_typeof(horario_funcionamento) = 'array');

-- ---------------------------------------------------------------------
-- fn_hora_legivel — "09:00" vira "9h", "13:30" vira "13h30"
-- ---------------------------------------------------------------------
--
-- Mesma forma de `horaCurta` em src/lib/datas.ts, porque o destino é o
-- mesmo texto que o cliente lê. "09:00 às 18:00" soa a horário de trem.
--
-- Devolve o valor como veio quando não reconhece o formato, pela mesma
-- razão de `fn_telefone_legivel`: melhor exibir o cadastrado do que
-- inventar uma máscara sobre algo que não é hora.
create or replace function public.fn_hora_legivel(bruto text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case
    when t is null                    then null
    when t !~ '^\d{1,2}:\d{2}'        then t
    when split_part(t, ':', 2) = '00' then (split_part(t, ':', 1))::int::text || 'h'
    else (split_part(t, ':', 1))::int::text || 'h' || split_part(t, ':', 2)
  end
  from (select nullif(trim(bruto), '') as t) x;
$fn$;

comment on function public.fn_hora_legivel(text) is
  'Formata hora para leitura humana: 09:00 vira 9h, 13:30 vira 13h30. Usada por fn_horario_funcionamento_legivel.';

-- ---------------------------------------------------------------------
-- fn_horario_funcionamento_legivel — a semana em uma frase
-- ---------------------------------------------------------------------
--
-- "segunda a sexta das 9h às 18h; sábado das 9h às 13h; domingo fechado"
--
-- **Só os dias abertos formam grupo.** Os fechados entram uma vez só, no
-- fim, como complemento. Tratados como grupo de primeira classe eles se
-- intercalam e a frase abre pelo que a imobiliária não faz: quem atende
-- só quarta lia "segunda e terça fechados; quarta das 14h às 18h;
-- quinta a domingo fechados", três orações para dizer uma.
--
-- **O agrupamento acontece sobre a lista já filtrada**, e é o que
-- permite juntar dias não vizinhos: segunda, quarta e sexta são
-- consecutivos entre os abertos e viram uma oração só. A contiguidade
-- na semana é conferida à parte, para decidir entre "segunda a sexta" e
-- "segunda, quarta e sexta" — um intervalo com buraco no meio diria que
-- a imobiliária abre na terça.
--
-- **A semana começa na segunda**, e não no domingo da convenção de
-- `dia_semana`, porque é assim que se lê horário comercial.
--
-- **O separador é ponto e vírgula, não ponto.** Com ponto, cada oração
-- seguinte começaria com nome de dia em minúscula depois de um ponto
-- final, e capitalizar deixaria "Sábado" com maiúscula no meio de uma
-- frase que já começou.
create or replace function public.fn_horario_funcionamento_legivel(bruto jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  with dias as (
    -- `dia` mantém a convenção 0 = domingo; `ordem` é a leitura.
    select * from (values
      (1, 1, 'segunda'), (2, 2, 'terça'),  (3, 3, 'quarta'),
      (4, 4, 'quinta'),  (5, 5, 'sexta'),  (6, 6, 'sábado'),
      (0, 7, 'domingo')
    ) as d(dia, ordem, nome)
  ),
  entradas as (
    select
      d.ordem,
      d.nome,
      -- Comparação contra `'true'::jsonb` em vez de cast para boolean:
      -- a coluna é jsonb e um `"sim"` cadastrado à mão derrubaria o
      -- cast, levando junto a consulta inteira da view.
      coalesce(e.valor -> 'aberto' = 'true'::jsonb, false) as aberto,
      public.fn_hora_legivel(e.valor ->> 'abre')           as abre,
      public.fn_hora_legivel(e.valor ->> 'fecha')          as fecha
    from dias d
    left join lateral (
      select v as valor
      from jsonb_array_elements(bruto) v
      where (v ->> 'dia') ~ '^\d+$'
        and (v ->> 'dia')::int = d.dia
      limit 1
    ) e on true
  ),
  -- Só os abertos, renumerados. `pos` é a posição entre eles; `ordem`
  -- continua sendo a posição na semana, e as duas são necessárias.
  abertos as (
    select
      ordem, nome, abre, fecha,
      row_number() over (order by ordem) as pos
    from entradas
    where aberto
  ),
  -- Ilhas sobre a lista filtrada: entradas vizinhas *entre os abertos*
  -- que compartilham (abre, fecha) recebem o mesmo `grupo`.
  ilhas as (
    select
      a.*,
      a.pos - row_number() over (partition by abre, fecha order by pos) as grupo
    from abertos a
  ),
  grupos as (
    select
      min(pos)                                 as inicio,
      count(*)::int                            as quantos,
      -- Contíguo na semana, não na lista filtrada. Sem isto, segunda,
      -- quarta e sexta virariam "segunda a sexta", que afirma terça.
      (max(ordem) - min(ordem) + 1) = count(*) as contiguo,
      array_agg(nome order by ordem)           as nomes,
      (array_agg(nome order by ordem))[1]      as primeiro,
      (array_agg(nome order by ordem desc))[1] as ultimo,
      abre, fecha
    from ilhas
    group by grupo, abre, fecha
  ),
  frases as (
    select
      inicio,
      case
        -- A semana inteira não se lê como intervalo: "segunda a
        -- domingo" faz procurar a exceção que não existe.
        when quantos = 7               then 'todos os dias'
        when quantos = 1               then primeiro
        -- Intervalo só a partir de três. Para dois, "sábado e domingo"
        -- é mais curto e mais claro do que "sábado a domingo".
        when contiguo and quantos >= 3 then primeiro || ' a ' || ultimo
        else array_to_string(nomes[1:quantos - 1], ', ') || ' e ' || ultimo
      end || ' das ' || abre || ' às ' || fecha as texto
    from grupos
  ),
  -- Os fechados, numa oração só e sempre no fim.
  fechados as (
    select
      count(*)::int                            as quantos,
      (max(ordem) - min(ordem) + 1) = count(*) as contiguo,
      array_agg(nome order by ordem)           as nomes,
      (array_agg(nome order by ordem))[1]      as primeiro,
      (array_agg(nome order by ordem desc))[1] as ultimo
    from entradas
    where not aberto
    having count(*) > 0
  ),
  frase_fechados as (
    select
      case
        when quantos = 1               then primeiro || ' fechado'
        when contiguo and quantos >= 3 then primeiro || ' a ' || ultimo || ' fechados'
        else array_to_string(nomes[1:quantos - 1], ', ') || ' e ' || ultimo || ' fechados'
      end as texto
    from fechados
  )
  select case
    -- Dia aberto sem horário cadastrado: não dá para afirmar o horário
    -- nem chamá-lo de fechado. Some a frase inteira, em vez de o texto
    -- dizer algo que o cadastro não diz.
    when exists (select 1 from entradas where aberto and (abre is null or fecha is null))
      then null

    -- Nenhum dia aberto é o mesmo que não informado. Não existe
    -- imobiliária fechada a semana toda, e anunciar "fechado todos os
    -- dias" seria pior do que não dizer nada.
    when not exists (select 1 from entradas where aberto)
      then null

    else concat_ws('; ',
      (select string_agg(texto, '; ' order by inicio) from frases),
      (select texto from frase_fechados)
    )
  end;
$fn$;

comment on function public.fn_horario_funcionamento_legivel(jsonb) is
  'Horário de atendimento em uma frase, agrupando dias consecutivos iguais. Devolve nulo quando nada foi informado ou quando o cadastro está incompleto.';

-- ---------------------------------------------------------------------
-- info_imob_agente — recriada com a linha de atendimento
-- ---------------------------------------------------------------------
--
-- Só muda em relação à migration 022 pela linha "Atendimento", logo
-- depois do endereço: "onde" e "quando" são a mesma pergunta para quem
-- está decidindo se vai até lá.
create or replace view public.info_imob_agente
with (security_invoker = true)
as
with bruto as (
  select
    nullif(trim(c.nome_negocio), '')                              as nome,
    nullif(trim(c.endereco), '')                                  as endereco,
    nullif(trim(c.cidade), '')                                    as cidade,
    nullif(trim(c.estado), '')                                    as estado,
    nullif(regexp_replace(coalesce(c.cep, ''), '\D', '', 'g'), '') as cep,
    public.fn_telefone_legivel(c.telefone)                        as telefone,
    public.fn_telefone_legivel(c.whatsapp)                         as whatsapp,
    nullif(trim(c.email), '')                                     as email,
    public.fn_url_absoluta(c.site)                                as site,
    public.fn_url_absoluta(c.link_google_maps)                    as maps,
    public.fn_horario_funcionamento_legivel(c.horario_funcionamento) as atendimento,

    -- Sai como URL completa, não como @usuario. O destino é o WhatsApp:
    -- `@alvorada` não é clicável, o cliente teria que copiar o nome e
    -- procurar dentro do aplicativo, e é aí que ele desiste.
    --
    -- O handle é extraído primeiro justamente porque o dono digita das
    -- três formas (handle, @handle ou URL inteira), e concatenar sem
    -- extrair produziria `instagram.com/https://instagram.com/alvorada`.
    --
    -- O `nullif` no fim cobre o cadastro que é só `instagram.com/`: sem
    -- ele sobraria uma linha apontando para a home do Instagram.
    case
      when nullif(trim(c.instagram), '') is null then null
      else 'https://instagram.com/' || nullif(
             regexp_replace(
               regexp_replace(trim(c.instagram), '^.*instagram\.com/', '', 'i'),
               '^@|[/?#].*$', '', 'g'),
             '')
    end                                                           as instagram
  from public.configuracoes c
),
linhas as (
  select
    nome, maps, telefone, whatsapp, email, site, instagram, atendimento,
    -- "Rua das Palmeiras, 320, Sorocaba, SP, CEP 18040-330"
    nullif(
      concat_ws(', ',
        endereco,
        nullif(concat_ws(', ', cidade, estado), ''),
        case
          when length(cep) = 8   then 'CEP ' || substr(cep, 1, 5) || '-' || substr(cep, 6)
          when cep is not null   then 'CEP ' || cep
        end
      ),
      ''
    ) as endereco_completo
  from bruto
)
select
  -- Uma informação por linha, não frase corrida. Três das linhas
  -- terminam em endereço da web, e numa frase corrida os links se
  -- encostam nas vírgulas e nenhum deles fica clicável inteiro.
  --
  -- As linhas de link **não** levam ponto final: ponto colado numa URL
  -- é engolido pelo endereço em vários aplicativos de mensagem, e o
  -- link chega quebrado justamente onde ele mais importa.
  concat_ws(
    chr(10),
    nome                                 || '.',
    'Endereço: '    || endereco_completo || '.',
    'Como chegar: ' || maps,
    'Atendimento: ' || atendimento       || '.',
    'Telefone: '    || telefone,
    'WhatsApp: '    || whatsapp,
    'E-mail: '      || email,
    'Site: '        || site,
    'Instagram: '   || instagram
  ) as informacoes
from linhas;

comment on view public.info_imob_agente is
  'Dados da imobiliária em uma única coluna de texto, prontos para o agente de IA repassar ao cliente. Lê configuracoes em tempo real; campo vazio não gera linha; os três endereços da web saem como link absoluto.';

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------
--
-- Mesma régua da migration 022: `anon` fica de fora por disciplina, e as
-- funções de apoio acompanham a view.
revoke all    on public.info_imob_agente from anon;
grant  select on public.info_imob_agente to authenticated, service_role;

revoke all     on function public.fn_hora_legivel(text) from public, anon;
grant  execute on function public.fn_hora_legivel(text) to authenticated, service_role;

revoke all     on function public.fn_horario_funcionamento_legivel(jsonb) from public, anon;
grant  execute on function public.fn_horario_funcionamento_legivel(jsonb) to authenticated, service_role;
