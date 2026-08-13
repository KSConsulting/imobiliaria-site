-- =====================================================================
-- ImobFlow — 20. WhatsApp em formato único, com código do país
-- =====================================================================
--
-- `crm_imobiliaria.whatsapp` é UNIQUE e é a chave natural do lead. Até
-- aqui ele tinha DOIS formatos convivendo, por dois caminhos de escrita:
--
--   • A Edge Function `api` REMOVIA o código do país antes de gravar,
--     deixando 11912345678
--   • O agente de IA, que escreve direto na tabela pelo N8N, grava o
--     número completo: 5511912345678
--
-- A mesma pessoa virava duas linhas, uma por caminho, e o UNIQUE não
-- pegava, porque as strings são diferentes. O sintoma aparece longe da
-- causa: o lead "sumiu" na busca por WhatsApp, o histórico da visita
-- ficou pendurado no cadastro errado, e o funil passou a mostrar dois
-- cards para o mesmo telefone.
--
-- O formato passa a ser E.164 sem o mais, em todos os caminhos, que é o
-- que o agente já usa e o que o wa.me aceita sem conversão.
--
-- Esta migration só arruma o que já está gravado. Quem passou a gravar
-- certo foi o painel (src/lib/telefone.ts) e a função `normalizarWhatsapp`
-- da Edge Function, que precisa de redeploy para valer.
-- =====================================================================

do $$
declare
  v_convertidos int;
  v_conflitos   int;
begin
  -- Conflito: existe o mesmo número nos dois formatos. Prefixar criaria
  -- violação de UNIQUE e derrubaria a migration inteira, então esses
  -- ficam de fora e são listados para junção manual.
  select count(*) into v_conflitos
  from public.crm_imobiliaria antigo
  where length(antigo.whatsapp) in (10, 11)
    and exists (
      select 1 from public.crm_imobiliaria novo
       where novo.whatsapp = '55' || antigo.whatsapp
    );

  -- 10 ou 11 dígitos é DDD mais assinante, sem código de país. Não dá
  -- para inferir outro país a partir de um DDD solto, e todo cadastro
  -- feito até aqui saiu de uma operação brasileira.
  update public.crm_imobiliaria antigo
     set whatsapp = '55' || antigo.whatsapp
   where length(antigo.whatsapp) in (10, 11)
     and not exists (
       select 1 from public.crm_imobiliaria novo
        where novo.whatsapp = '55' || antigo.whatsapp
     );

  get diagnostics v_convertidos = row_count;

  raise notice 'WhatsApp normalizado: % convertidos, % em conflito.', v_convertidos, v_conflitos;

  if v_conflitos > 0 then
    raise warning
      'Existem % leads com o mesmo telefone nos dois formatos. Eles NÃO foram convertidos, para não violar o UNIQUE. Junte os cadastros à mão e rode esta migration de novo.',
      v_conflitos;
  end if;
end $$;

-- Consulta de apoio, para quando o aviso acima aparecer. Mostra os
-- pares que precisam ser unidos antes de rodar de novo:
--
--   select antigo.id  as id_sem_codigo,  antigo.whatsapp  as sem_codigo,
--          novo.id    as id_com_codigo,  novo.whatsapp    as com_codigo
--     from public.crm_imobiliaria antigo
--     join public.crm_imobiliaria novo on novo.whatsapp = '55' || antigo.whatsapp
--    where length(antigo.whatsapp) in (10, 11);
--
-- NÃO existe constraint de formato nesta tabela, e é decisão consciente.
-- Um CHECK obrigando 8 a 15 dígitos protegeria contra escrita torta,
-- inclusive a do N8N, que roda com service role e ignora o RLS. Mas ele
-- também faria o cadastro de lead do agente FALHAR no primeiro número
-- que chegasse com máscara, em produção, sem ninguém olhando. Se o fluxo
-- do agente for auditado e confirmado, vale adicionar:
--
--   alter table public.crm_imobiliaria
--     add constraint crm_imobiliaria_whatsapp_e164
--     check (whatsapp ~ '^[0-9]{8,15}$');
