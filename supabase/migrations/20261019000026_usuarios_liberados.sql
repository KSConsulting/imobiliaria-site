-- =====================================================================
-- ImobFlow — Sessão não é permissão: o painel só abre para usuário liberado
--
-- Até aqui toda política de escrita e de leitura do painel era
-- `to authenticated using (true)`. Isso supunha que só existe sessão para
-- quem o desenvolvedor criou em Authentication > Users, e a suposição é
-- falsa: o endpoint de cadastro do Supabase Auth responde a qualquer um
-- que tenha a chave anônima, e a chave anônima vai dentro do JavaScript
-- da vitrine. Não ter tela de cadastro não fecha o endpoint.
--
-- Com o cadastro público ligado (o padrão de todo projeto novo), um
-- visitante criava a própria conta, confirmava o e-mail e passava a ler
-- todos os leads, o contato dos proprietários e os tokens da API em
-- texto puro, além de poder excluir qualquer coisa.
--
-- Existir em `public.usuarios` também não serve de prova, porque o
-- trigger `trg_auth_users_espelhar_usuario` espelha TODA conta criada no
-- Auth, inclusive a do visitante. Por isso a marca é uma coluna nova, que
-- nasce falsa, e só um usuário já liberado (ou o SQL Editor) a liga.
--
-- Desligar "Allow new users to sign up" no painel do Supabase continua
-- sendo obrigatório. Esta migration é a segunda tranca: se o cadastro for
-- religado por engano, a conta nova abre sessão e não enxerga nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A marca
-- ---------------------------------------------------------------------
alter table public.usuarios
  add column if not exists liberado boolean not null default false;

comment on column public.usuarios.liberado is
  'Acesso ao painel. Nasce falso para toda conta, inclusive a criada pelo cadastro público do Auth. Ligado pelo desenvolvedor, no SQL Editor, ou por outro usuário liberado.';

-- Quem já existia antes desta migration foi criado pelo desenvolvedor,
-- pelo único caminho documentado até aqui. Mantém o acesso.
--
-- ATENÇÃO: se o cadastro público já estava ligado em produção, confira a
-- lista com `select email, created_at from public.usuarios;` depois de
-- aplicar, e desligue quem não for da equipe.
update public.usuarios set liberado = true where liberado = false;

-- ---------------------------------------------------------------------
-- 2. A pergunta, num lugar só
-- ---------------------------------------------------------------------
-- SECURITY DEFINER porque é chamada de dentro das políticas de
-- `usuarios`: como invoker, ela leria a tabela pelo RLS que está sendo
-- avaliado e entraria em recursão.
create or replace function public.fn_usuario_liberado()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios
     where id = auth.uid()
       and liberado
  );
$$;

comment on function public.fn_usuario_liberado() is
  'Verdadeiro quando o usuário da sessão tem acesso ao painel. Base de todas as políticas de authenticated.';

revoke all on function public.fn_usuario_liberado() from public, anon;
grant execute on function public.fn_usuario_liberado() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. As políticas
-- ---------------------------------------------------------------------
-- `alter policy` troca só a expressão: nome, comando e papel continuam
-- os da migration 008. O `(select …)` em volta da chamada faz o Postgres
-- avaliar a função uma vez por consulta, e não uma vez por linha.

alter policy usuarios_autenticado_tudo on public.usuarios
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

-- O usuário ainda não liberado precisa ler a própria linha: é por ela
-- que o login descobre que deve recusar a entrada e dizer o porquê, em
-- vez de abrir um painel vazio que parece defeito.
drop policy if exists usuarios_le_a_propria_linha on public.usuarios;
create policy usuarios_le_a_propria_linha on public.usuarios
  for select to authenticated using (id = (select auth.uid()));

alter policy api_tokens_autenticado_tudo on public.api_tokens
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy configuracoes_autenticado_tudo on public.configuracoes
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy logs_sistema_autenticado_leitura on public.logs_sistema
  using ((select public.fn_usuario_liberado()));

alter policy logs_sistema_autenticado_insercao on public.logs_sistema
  with check ((select public.fn_usuario_liberado()));

alter policy crm_autenticado_tudo on public.crm_imobiliaria
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy tipos_imovel_autenticado_tudo on public.tipos_imovel
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy imoveis_autenticado_tudo on public.imoveis
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy imoveis_fotos_autenticado_tudo on public.imoveis_fotos
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy corretores_autenticado_tudo on public.corretores
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy agendas_autenticado_tudo on public.agendas
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy agendas_horarios_autenticado_tudo on public.agendas_horarios
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy agendamentos_autenticado_tudo on public.agendamentos
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

alter policy visualizacoes_autenticado_tudo on public.visualizacoes_site
  using ((select public.fn_usuario_liberado()))
  with check ((select public.fn_usuario_liberado()));

-- ---------------------------------------------------------------------
-- 4. Storage
-- ---------------------------------------------------------------------
-- A leitura dos dois buckets continua pública: a vitrine serve as fotos
-- direto dele. Só a escrita muda, e sem ela um visitante com conta
-- trocaria a logo ou apagaria as fotos da carteira.

alter policy storage_logos_insercao_auth on storage.objects
  with check (bucket_id = 'logos' and (select public.fn_usuario_liberado()));

alter policy storage_logos_atualizacao_auth on storage.objects
  using      (bucket_id = 'logos' and (select public.fn_usuario_liberado()))
  with check (bucket_id = 'logos' and (select public.fn_usuario_liberado()));

alter policy storage_logos_exclusao_auth on storage.objects
  using (bucket_id = 'logos' and (select public.fn_usuario_liberado()));

alter policy storage_imoveis_insercao_auth on storage.objects
  with check (bucket_id = 'imoveis' and (select public.fn_usuario_liberado()));

alter policy storage_imoveis_atualizacao_auth on storage.objects
  using      (bucket_id = 'imoveis' and (select public.fn_usuario_liberado()))
  with check (bucket_id = 'imoveis' and (select public.fn_usuario_liberado()));

alter policy storage_imoveis_exclusao_auth on storage.objects
  using (bucket_id = 'imoveis' and (select public.fn_usuario_liberado()));
