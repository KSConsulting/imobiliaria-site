-- =====================================================================
-- ImobFlow — 22. info_imob_agente (dados da imobiliária em uma coluna)
-- =====================================================================
--
-- Uma view de coluna única, para o agente de IA ler o bloco inteiro de
-- dados da imobiliária num `select` só e repassar ao cliente sem
-- recompor nada.
--
-- **Por que view e não tabela.** Os dados são de `configuracoes`, o
-- registro único que o dono edita no painel. Uma tabela espelho exigiria
-- trigger de sincronia e, no dia em que o trigger falhasse ou alguém
-- escrevesse com service role, o agente passaria a informar o telefone
-- antigo sem nada indicar o motivo. A view lê a origem toda vez.
--
-- **Por que uma coluna só.** Dez colunas obrigariam o agente a compor a
-- resposta, e é aí que ele inventa "Instagram: não informado" ou emenda
-- uma vírgula sobrando. Mesma razão do endpoint GET /imobiliaria.
--
-- **Campo vazio não vira linha.** Cada linha é montada inteira ou não é
-- montada. É o que garante que o texto continue legível com qualquer
-- combinação de campos preenchidos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_telefone_legivel — a máscara de telefone, num lugar só
-- ---------------------------------------------------------------------
--
-- Existe para não repetir o mesmo CASE em `telefone` e em `whatsapp`
-- dentro da view. O `whatsapp` é gravado em E.164 sem o mais
-- (5515997151311), e o cliente lê melhor (15) 99715-1311.
--
-- Devolve o valor original quando não reconhece o formato: número de
-- outro país não deve virar parêntese torto.
create or replace function public.fn_telefone_legivel(bruto text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when n is null        then null
    when length(n) = 11   then '(' || substr(n, 1, 2) || ') ' || substr(n, 3, 5) || '-' || substr(n, 8)
    when length(n) = 10   then '(' || substr(n, 1, 2) || ') ' || substr(n, 3, 4) || '-' || substr(n, 7)
    else bruto
  end
  from (
    -- Tira o DDI só quando sobra número depois dele: 5511999999999 tem
    -- 13 dígitos e vira 11999999999; 5511999999 poderia ser um fixo de
    -- DDD 55 e fica como está.
    select case
             when d like '55%' and length(d) > 11 then substr(d, 3)
             else d
           end as n
    from (
      select nullif(regexp_replace(coalesce(bruto, ''), '\D', '', 'g'), '') as d
    ) digitos
  ) nacional;
$$;

comment on function public.fn_telefone_legivel(text) is
  'Formata telefone brasileiro para leitura humana, tirando o DDI 55 quando presente. Usada por info_imob_agente.';

-- ---------------------------------------------------------------------
-- fn_url_absoluta — link que abre ao ser tocado
-- ---------------------------------------------------------------------
--
-- O destino deste texto é o WhatsApp. Endereço sem protocolo não vira
-- link clicável na conversa: o cliente teria que copiar e colar no
-- navegador, e é aí que ele desiste.
--
-- Preserva `http://` quando é o que está cadastrado, em vez de forçar
-- `https`: o site do cliente pode não ter certificado, e trocar o
-- esquema produziria um link que dá erro de segurança.
create or replace function public.fn_url_absoluta(bruto text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case
    when v is null         then null
    when v ~* '^https?://'  then rtrim(v, '/')
    else                        'https://' || rtrim(v, '/')
  end
  from (select nullif(trim(bruto), '') as v) x;
$fn$;

comment on function public.fn_url_absoluta(text) is
  'Garante que o endereço saia como link clicável: prefixa https:// quando falta e remove barra final. Usada por info_imob_agente.';

-- ---------------------------------------------------------------------
-- info_imob_agente
-- ---------------------------------------------------------------------
--
-- `security_invoker = true` é obrigatório: sem ele a view roda com os
-- privilégios do dono e passa por cima do RLS de `configuracoes`, que é
-- o alerta `security_definer_view` do linter do Supabase. Requer
-- Postgres 15 ou superior.
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
    nome, maps, telefone, whatsapp, email, site, instagram,
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
-- O grant da migration 008 valeu para as tabelas que existiam naquele
-- momento, então a view precisa do seu.
--
-- `anon` fica de fora por disciplina, não por sigilo: os mesmos dados já
-- saem no rodapé do site público. O que não faz sentido é entregar o
-- bloco pronto do agente a quem não é o agente.
revoke all    on public.info_imob_agente from anon;
grant  select on public.info_imob_agente to authenticated, service_role;

revoke all           on function public.fn_telefone_legivel(text) from public, anon;
grant  execute       on function public.fn_telefone_legivel(text) to authenticated, service_role;

revoke all           on function public.fn_url_absoluta(text) from public, anon;
grant  execute       on function public.fn_url_absoluta(text) to authenticated, service_role;
