-- =====================================================================
-- ImobFlow — Etapa 1 — 07. Funções e triggers de regra de negócio
-- =====================================================================
-- Todas as funções de trigger são SECURITY DEFINER: elas precisam ler e
-- escrever tabelas que o papel chamador (anon, no caso do site público)
-- não enxerga através das políticas de RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: fuso horário configurado
-- ---------------------------------------------------------------------
create or replace function public.fn_fuso_horario()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select fuso_horario from public.configuracoes limit 1), 'America/Sao_Paulo');
$$;

comment on function public.fn_fuso_horario() is
  'Fuso horário da imobiliária, lido de configuracoes. Usado nas validações de agenda.';

-- =====================================================================
-- TRIGGER 2 — Geração automática do código do imóvel (IMV-XXXX)
-- =====================================================================
create or replace function public.fn_gerar_codigo_imovel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numero text;
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    v_numero := nextval('public.seq_codigo_imovel')::text;
    -- lpad trunca strings maiores que o tamanho pedido; acima de 9999 o
    -- número cresce naturalmente (IMV-12500)
    if length(v_numero) < 4 then
      v_numero := lpad(v_numero, 4, '0');
    end if;
    new.codigo := 'IMV-' || v_numero;
  end if;
  return new;
end;
$$;

comment on function public.fn_gerar_codigo_imovel() is
  'TRIGGER 2 — BEFORE INSERT em imoveis. Gera o código IMV-XXXX a partir de uma sequence. Sequence não colide e dispensa retry.';

drop trigger if exists trg_imoveis_gerar_codigo on public.imoveis;
create trigger trg_imoveis_gerar_codigo
  before insert on public.imoveis
  for each row execute function public.fn_gerar_codigo_imovel();

-- =====================================================================
-- TRIGGER 3 — Criação automática da agenda do corretor
-- =====================================================================
create or replace function public.fn_criar_agenda_corretor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id_agenda uuid;
  v_dia       integer;
begin
  insert into public.agendas (id_corretor, duracao_slot)
  values (new.id, 30)
  returning id into v_id_agenda;

  -- Janela padrão: segunda a sexta, 09:00 às 18:00.
  -- Sem isso o corretor nasce sem disponibilidade e a API responde
  -- "sem horários" sem que ninguém entenda o motivo.
  for v_dia in 1..5 loop
    insert into public.agendas_horarios (id_agenda, dia_semana, hora_inicio, hora_fim, ativo)
    values (v_id_agenda, v_dia, time '09:00', time '18:00', true);
  end loop;

  return new;
end;
$$;

comment on function public.fn_criar_agenda_corretor() is
  'TRIGGER 3 — AFTER INSERT em corretores. Cria a agenda (slot de 30 min) e a janela padrão seg-sex 09:00-18:00.';

drop trigger if exists trg_corretores_criar_agenda on public.corretores;
create trigger trg_corretores_criar_agenda
  after insert on public.corretores
  for each row execute function public.fn_criar_agenda_corretor();

-- =====================================================================
-- TRIGGER 4 — Validação de conflito de horário
-- =====================================================================
create or replace function public.fn_validar_conflito_agendamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz        text := public.fn_fuso_horario();
  v_conflito  record;
begin
  -- Agendamentos cancelados ou reagendados não ocupam a agenda
  if new.status not in ('agendada', 'realizada') then
    return new;
  end if;

  select a.data_hora_inicio, a.data_hora_fim
    into v_conflito
    from public.agendamentos a
   where a.id_corretor = new.id_corretor
     and a.id <> new.id
     and a.status in ('agendada', 'realizada')
     and a.data_hora_inicio < new.data_hora_fim
     and a.data_hora_fim    > new.data_hora_inicio
   limit 1;

  if found then
    raise exception
      'Conflito de agenda: o corretor já possui uma visita das % às % nesse intervalo.',
      to_char(v_conflito.data_hora_inicio at time zone v_tz, 'DD/MM/YYYY HH24:MI'),
      to_char(v_conflito.data_hora_fim    at time zone v_tz, 'HH24:MI')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.fn_validar_conflito_agendamento() is
  'TRIGGER 4 — BEFORE INSERT OR UPDATE em agendamentos. Impede sobreposição de visitas do mesmo corretor.';

drop trigger if exists trg_agendamentos_validar_conflito on public.agendamentos;
create trigger trg_agendamentos_validar_conflito
  before insert or update on public.agendamentos
  for each row execute function public.fn_validar_conflito_agendamento();

-- =====================================================================
-- TRIGGER 5 — Validação da janela de atendimento
-- =====================================================================
create or replace function public.fn_validar_janela_atendimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz          text := public.fn_fuso_horario();
  v_ini_local   timestamp;
  v_fim_local   timestamp;
  v_dia_semana  integer;
  v_nome_dia    text;
  v_nomes       text[] := array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
begin
  if new.status not in ('agendada', 'realizada') then
    return new;
  end if;

  v_ini_local  := new.data_hora_inicio at time zone v_tz;
  v_fim_local  := new.data_hora_fim    at time zone v_tz;
  v_dia_semana := extract(dow from v_ini_local)::integer;
  v_nome_dia   := v_nomes[v_dia_semana + 1];

  if not exists (
    select 1
      from public.agendas ag
      join public.agendas_horarios h on h.id_agenda = ag.id
     where ag.id_corretor = new.id_corretor
       and h.ativo
       and h.dia_semana  = v_dia_semana
       and v_ini_local::time >= h.hora_inicio
       and v_fim_local::time <= h.hora_fim
       and v_ini_local::date = v_fim_local::date
  ) then
    raise exception
      'Horário fora da janela de atendimento: o corretor não atende % das % às %.',
      v_nome_dia,
      to_char(v_ini_local, 'HH24:MI'),
      to_char(v_fim_local, 'HH24:MI')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.fn_validar_janela_atendimento() is
  'TRIGGER 5 — BEFORE INSERT OR UPDATE em agendamentos. Garante que a visita cai dentro de agendas_horarios do corretor.';

drop trigger if exists trg_agendamentos_validar_janela on public.agendamentos;
create trigger trg_agendamentos_validar_janela
  before insert or update on public.agendamentos
  for each row execute function public.fn_validar_janela_atendimento();

-- =====================================================================
-- TRIGGER 6 — Limite de 10 fotos por imóvel
-- =====================================================================
create or replace function public.fn_validar_limite_fotos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
begin
  select count(*) into v_total
    from public.imoveis_fotos
   where id_imovel = new.id_imovel;

  if v_total >= 10 then
    raise exception 'Limite de fotos atingido: cada imóvel aceita no máximo 10 fotos.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.fn_validar_limite_fotos() is
  'TRIGGER 6 — BEFORE INSERT em imoveis_fotos. Bloqueia a 11ª foto.';

drop trigger if exists trg_imoveis_fotos_limite on public.imoveis_fotos;
create trigger trg_imoveis_fotos_limite
  before insert on public.imoveis_fotos
  for each row execute function public.fn_validar_limite_fotos();

-- =====================================================================
-- TRIGGER 7 — Lead vira cliente ao visitar
-- =====================================================================
create or replace function public.fn_lead_vira_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Guarda de recursão: o TRIGGER 8 escreve em crm_imobiliaria, o que
  -- dispara este trigger, que escreve de novo na mesma tabela.
  -- Só escreve quando o status mudou de fato E o tipo ainda não é cliente.
  if new.status = 'visitou'
     and old.status is distinct from new.status
     and new.tipo is distinct from 'cliente'
  then
    update public.crm_imobiliaria
       set tipo = 'cliente'
     where id = new.id
       and tipo is distinct from 'cliente';
  end if;

  return null;
end;
$$;

comment on function public.fn_lead_vira_cliente() is
  'TRIGGER 7 — AFTER UPDATE em crm_imobiliaria. status = visitou promove tipo para cliente, com guarda contra recursão.';

drop trigger if exists trg_crm_lead_vira_cliente on public.crm_imobiliaria;
create trigger trg_crm_lead_vira_cliente
  after update on public.crm_imobiliaria
  for each row
  when (new.status = 'visitou'
        and old.status is distinct from new.status
        and new.tipo is distinct from 'cliente')
  execute function public.fn_lead_vira_cliente();

-- =====================================================================
-- TRIGGER 8 — Sincronização de status entre agendamento e lead
-- =====================================================================
create or replace function public.fn_sincronizar_status_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proximo record;
begin
  if tg_op = 'INSERT' then
    if new.status in ('agendada', 'realizada') then
      update public.crm_imobiliaria
         set status           = case when new.status = 'realizada' then 'visitou' else 'agendou' end,
             data_agendamento = new.data_hora_inicio,
             id_agendamento   = new.id::text
       where id = new.id_lead;
    end if;
    return null;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then

    if new.status = 'realizada' then
      update public.crm_imobiliaria
         set status           = 'visitou',
             data_agendamento = new.data_hora_inicio,
             id_agendamento   = new.id::text
       where id = new.id_lead;

    elsif new.status = 'cancelada' then
      -- Só rebaixa para cancelou quando não restar nenhuma visita agendada
      select a.id, a.data_hora_inicio
        into v_proximo
        from public.agendamentos a
       where a.id_lead = new.id_lead
         and a.id <> new.id
         and a.status = 'agendada'
       order by a.data_hora_inicio asc
       limit 1;

      if found then
        update public.crm_imobiliaria
           set status           = 'agendou',
               data_agendamento = v_proximo.data_hora_inicio,
               id_agendamento   = v_proximo.id::text
         where id = new.id_lead;
      else
        update public.crm_imobiliaria
           set status           = 'cancelou',
               data_agendamento = null,
               id_agendamento   = null
         where id = new.id_lead;
      end if;

    elsif new.status = 'agendada' then
      update public.crm_imobiliaria
         set status           = 'agendou',
             data_agendamento = new.data_hora_inicio,
             id_agendamento   = new.id::text
       where id = new.id_lead;
    end if;

  elsif new.status = 'agendada'
        and new.data_hora_inicio is distinct from old.data_hora_inicio then
    -- Visita remarcada no mesmo registro: mantém o lead apontando para o horário certo
    update public.crm_imobiliaria
       set data_agendamento = new.data_hora_inicio,
           id_agendamento   = new.id::text
     where id = new.id_lead;
  end if;

  return null;
end;
$$;

comment on function public.fn_sincronizar_status_lead() is
  'TRIGGER 8 — AFTER INSERT OR UPDATE em agendamentos. Move o lead no funil conforme o agendamento; no cancelamento verifica se resta outra visita agendada antes de rebaixar para cancelou.';

drop trigger if exists trg_agendamentos_sincronizar_lead on public.agendamentos;
create trigger trg_agendamentos_sincronizar_lead
  after insert or update on public.agendamentos
  for each row execute function public.fn_sincronizar_status_lead();

-- =====================================================================
-- TRIGGER 9 — Cálculo de minutos_ultima_mensagem
-- =====================================================================
create or replace function public.fn_calcular_minutos_ultima_mensagem()
returns trigger
language plpgsql
as $$
begin
  if new.ultima_mensagem is distinct from old.ultima_mensagem then
    if new.ultima_mensagem is null then
      new.minutos_ultima_mensagem := null;
    else
      new.minutos_ultima_mensagem :=
        floor(extract(epoch from (now() - new.ultima_mensagem)) / 60)::integer;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.fn_calcular_minutos_ultima_mensagem() is
  'TRIGGER 9 — BEFORE UPDATE em crm_imobiliaria. Recalcula minutos_ultima_mensagem sempre que ultima_mensagem muda.';

drop trigger if exists trg_crm_minutos_ultima_mensagem on public.crm_imobiliaria;
create trigger trg_crm_minutos_ultima_mensagem
  before update on public.crm_imobiliaria
  for each row execute function public.fn_calcular_minutos_ultima_mensagem();

-- =====================================================================
-- TRIGGER 10 — Contadores de visualização e clique
-- =====================================================================
create or replace function public.fn_atualizar_contadores_imovel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ja_visto boolean;
begin
  if new.id_imovel is null then
    return null;
  end if;

  if new.tipo_evento = 'visualizacao' then
    -- Deduplicação por sessão: sem isso cada recarregamento vira
    -- visualização nova e o ranking infla.
    if new.session_id is null then
      v_ja_visto := false;
    else
      -- O desempate por (created_at, id) é obrigatório: em INSERT de
      -- múltiplas linhas o trigger AFTER dispara com todas as linhas já
      -- visíveis. Comparar apenas "existe outra linha" faria duas
      -- visualizações da mesma sessão se anularem e ninguém contaria.
      -- Assim, apenas a primeira linha da sessão incrementa.
      select exists (
        select 1
          from public.visualizacoes_site v
         where v.session_id  = new.session_id
           and v.id_imovel   = new.id_imovel
           and v.tipo_evento = 'visualizacao'
           and (v.created_at, v.id) < (new.created_at, new.id)
      ) into v_ja_visto;
    end if;

    if not v_ja_visto then
      update public.imoveis
         set total_visualizacoes = total_visualizacoes + 1
       where id = new.id_imovel;
    end if;

  elsif new.tipo_evento = 'clique_whatsapp' then
    -- Sem deduplicação: clicar duas vezes é intenção real.
    update public.imoveis
       set total_cliques_whatsapp = total_cliques_whatsapp + 1
     where id = new.id_imovel;
  end if;

  return null;
end;
$$;

comment on function public.fn_atualizar_contadores_imovel() is
  'TRIGGER 10 — AFTER INSERT em visualizacoes_site. Incrementa total_visualizacoes (deduplicado por session_id) e total_cliques_whatsapp (sem dedup).';

drop trigger if exists trg_visualizacoes_contadores on public.visualizacoes_site;
create trigger trg_visualizacoes_contadores
  after insert on public.visualizacoes_site
  for each row execute function public.fn_atualizar_contadores_imovel();

-- =====================================================================
-- TRIGGER 11 — Proteção na exclusão de tipo de imóvel
-- =====================================================================
-- Garantida declarativamente pela FK imoveis.id_tipo_imovel
-- ON DELETE RESTRICT. Nenhum tipo em uso pode ser removido.

-- =====================================================================
-- EXTRA — Espelhamento de auth.users em public.usuarios
-- =====================================================================
create or replace function public.fn_espelhar_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    insert into public.usuarios (id, nome, email)
    values (
      new.id,
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        split_part(new.email, '@', 1)
      ),
      new.email
    )
    on conflict (id) do nothing;
  exception when others then
    -- Nunca derruba a criação do usuário no Auth por causa do espelho
    raise warning 'Falha ao espelhar usuário % em public.usuarios: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

comment on function public.fn_espelhar_usuario_auth() is
  'AFTER INSERT em auth.users. Cria automaticamente o registro correspondente em public.usuarios, dispensando o passo manual.';

drop trigger if exists trg_auth_users_espelhar_usuario on auth.users;
create trigger trg_auth_users_espelhar_usuario
  after insert on auth.users
  for each row execute function public.fn_espelhar_usuario_auth();
