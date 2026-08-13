-- =====================================================================
-- minutos_ultima_mensagem recalculado de minuto em minuto
--
-- O trigger 9 grava a coluna no instante em que `ultima_mensagem` muda,
-- e ali ela congela: um lead parado há três dias continua dizendo o que
-- dizia no momento da última mensagem. Isso serve ao painel, que
-- recalcula na hora de exibir, mas não serve ao agente de IA, que lê a
-- tabela direto pelo N8N e precisa do número real para decidir follow-up.
--
-- A escolha aqui foi manter a coluna gravada e envelhecê-la por job, em
-- vez de calcular na leitura. O custo é reescrever as linhas com
-- conversa a cada minuto; o ganho é o agente ler a coluna crua sem view
-- nem endpoint no caminho.
-- =====================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 1. A função do job
-- ---------------------------------------------------------------------
create or replace function public.fn_atualizar_minutos_ultima_mensagem()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  -- `is distinct from` no where evita reescrever linha cujo minuto não
  -- virou. No regime de 1 em 1 minuto quase toda linha muda, mas a
  -- guarda torna a função segura de rodar à mão para conferir.
  update public.crm_imobiliaria
     set minutos_ultima_mensagem =
           floor(extract(epoch from (now() - ultima_mensagem)) / 60)::integer
   where ultima_mensagem is not null
     and minutos_ultima_mensagem is distinct from
           floor(extract(epoch from (now() - ultima_mensagem)) / 60)::integer;

  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.fn_atualizar_minutos_ultima_mensagem() is
  'Envelhece minutos_ultima_mensagem em todos os leads com conversa. Chamada pelo job pg_cron de 1 em 1 minuto. Devolve quantas linhas foram tocadas.';

revoke all on function public.fn_atualizar_minutos_ultima_mensagem() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. O job não pode carimbar updated_at
--
-- `fn_set_updated_at` roda em todo UPDATE da tabela. Com o cron, todo
-- lead passaria a ter updated_at de um minuto atrás, para sempre, e a
-- coluna deixaria de responder "quando esse lead foi mexido pela última
-- vez" — que é a única coisa que ela existe para dizer.
--
-- A guarda compara a linha inteira menos as duas colunas do job: se
-- alguma outra mudou, carimba normal; se só os minutos mudaram, não é
-- alteração do lead, é o relógio andando.
-- ---------------------------------------------------------------------
drop trigger if exists trg_crm_imobiliaria_updated_at on public.crm_imobiliaria;
create trigger trg_crm_imobiliaria_updated_at
  before update on public.crm_imobiliaria
  for each row
  when (
    (to_jsonb(old.*) - 'minutos_ultima_mensagem' - 'updated_at')
    is distinct from
    (to_jsonb(new.*) - 'minutos_ultima_mensagem' - 'updated_at')
  )
  execute function public.fn_set_updated_at();

-- O trigger 7 (lead vira cliente) já tem guarda de mudança de status e
-- não dispara aqui. O trigger 9 só age quando `ultima_mensagem` muda, e
-- o job não toca nela. Nenhum dos dois precisa de ajuste.

-- ---------------------------------------------------------------------
-- 3. O agendamento
-- ---------------------------------------------------------------------
do $mig$
begin
  if exists (select 1 from cron.job where jobname = 'minutos_ultima_mensagem') then
    perform cron.unschedule('minutos_ultima_mensagem');
  end if;
end
$mig$;

select cron.schedule(
  'minutos_ultima_mensagem',
  '* * * * *',
  $cron$select public.fn_atualizar_minutos_ultima_mensagem();$cron$
);

-- ---------------------------------------------------------------------
-- 4. O que este job NÃO faz
--
-- Não grava em logs_sistema. A trilha de auditoria registra ação de
-- gente e do agente; um job de relógio escreveria 1.440 linhas por dia
-- sobre nada, e enterraria o que se procura ali.
--
-- Não fecha a lacuna do INSERT: o trigger 9 continua sendo `before
-- update`, então um lead novo criado pelo upsert do agente nasce com a
-- coluna nula. Ele deixa de ser nulo na primeira passagem do cron, no
-- máximo 60 segundos depois, que é o motivo de a lacuna não ter virado
-- problema.
-- ---------------------------------------------------------------------
