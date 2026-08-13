-- =====================================================================
-- ImobFlow — Etapa 1 — 12. Endurecimento das funções
-- =====================================================================
-- Duas correções apontadas pelo linter de segurança do Supabase:
--
-- 1. O Postgres concede EXECUTE a PUBLIC por padrão em toda função nova.
--    Isso faz o PostgREST expor as funções em /rest/v1/rpc/<nome>, e as
--    de trigger são SECURITY DEFINER — rodam como postgres. Trigger não
--    precisa desse privilégio: o Postgres verifica EXECUTE na criação do
--    trigger, não a cada disparo. Revogar não afeta nada e fecha a porta.
--
-- 2. search_path fixo nas duas funções que ainda não tinham.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Revoga EXECUTE das funções de trigger
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
       and p.proname in (
         'fn_set_updated_at',
         'fn_fuso_horario',
         'fn_gerar_codigo_imovel',
         'fn_criar_agenda_corretor',
         'fn_validar_conflito_agendamento',
         'fn_validar_janela_atendimento',
         'fn_validar_limite_fotos',
         'fn_lead_vira_cliente',
         'fn_sincronizar_status_lead',
         'fn_calcular_minutos_ultima_mensagem',
         'fn_atualizar_contadores_imovel',
         'fn_espelhar_usuario_auth'
       )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_func);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. search_path fixo nas funções SECURITY INVOKER restantes
-- ---------------------------------------------------------------------
alter function public.fn_set_updated_at()                   set search_path = public, pg_temp;
alter function public.fn_calcular_minutos_ultima_mensagem() set search_path = public, pg_temp;
