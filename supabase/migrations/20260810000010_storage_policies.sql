-- =====================================================================
-- ImobFlow — Etapa 1 — 10. Políticas de Storage
-- =====================================================================
-- Leitura pública nos dois buckets (o site público serve as imagens
-- direto do Storage). Escrita apenas para usuários autenticados do
-- painel.
-- =====================================================================

drop policy if exists storage_logos_leitura_publica     on storage.objects;
drop policy if exists storage_logos_insercao_auth       on storage.objects;
drop policy if exists storage_logos_atualizacao_auth    on storage.objects;
drop policy if exists storage_logos_exclusao_auth       on storage.objects;
drop policy if exists storage_imoveis_leitura_publica   on storage.objects;
drop policy if exists storage_imoveis_insercao_auth     on storage.objects;
drop policy if exists storage_imoveis_atualizacao_auth  on storage.objects;
drop policy if exists storage_imoveis_exclusao_auth     on storage.objects;

create policy storage_logos_leitura_publica on storage.objects
  for select to public using (bucket_id = 'logos');

create policy storage_logos_insercao_auth on storage.objects
  for insert to authenticated with check (bucket_id = 'logos');

create policy storage_logos_atualizacao_auth on storage.objects
  for update to authenticated using (bucket_id = 'logos') with check (bucket_id = 'logos');

create policy storage_logos_exclusao_auth on storage.objects
  for delete to authenticated using (bucket_id = 'logos');

create policy storage_imoveis_leitura_publica on storage.objects
  for select to public using (bucket_id = 'imoveis');

create policy storage_imoveis_insercao_auth on storage.objects
  for insert to authenticated with check (bucket_id = 'imoveis');

create policy storage_imoveis_atualizacao_auth on storage.objects
  for update to authenticated using (bucket_id = 'imoveis') with check (bucket_id = 'imoveis');

create policy storage_imoveis_exclusao_auth on storage.objects
  for delete to authenticated using (bucket_id = 'imoveis');
