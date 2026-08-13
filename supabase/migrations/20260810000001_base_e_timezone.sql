-- =====================================================================
-- ImobFlow — Etapa 1 — 01. Base, timezone e função utilitária
-- =====================================================================

-- Timezone padrão do banco
alter database postgres set timezone to 'America/Sao_Paulo';
set time zone 'America/Sao_Paulo';

-- pgcrypto: gen_random_uuid()
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Função utilitária: atualiza updated_at em todo UPDATE
-- ---------------------------------------------------------------------
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.fn_set_updated_at() is
  'Preenche updated_at com now() em todo UPDATE. Usada por trigger BEFORE UPDATE nas tabelas que possuem a coluna.';
