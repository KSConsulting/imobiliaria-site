-- =====================================================================
-- ImobFlow — Etapa 1 — 11. Seed inicial
-- =====================================================================

-- configuracoes — registro único.
-- Os demais campos (logo, endereço, WhatsApp, redes) são preenchidos
-- pela tela de Configurações (Etapa 8).
insert into public.configuracoes (nome_negocio, fuso_horario)
select 'Imobiliaria Alvorada Imóveis', 'America/Sao_Paulo'
where not exists (select 1 from public.configuracoes);

-- tipos_imovel
insert into public.tipos_imovel (nome, ativo, ordem) values
  ('Casa',        true,  1),
  ('Apartamento', true,  2),
  ('Terreno',     true,  3),
  ('Chácara',     true,  4),
  ('Sítio',       true,  5),
  ('Comercial',   true,  6),
  ('Galpão',      true,  7),
  ('Cobertura',   true,  8),
  ('Kitnet',      true,  9),
  ('Fazenda',     true, 10),
  ('Sobrado',     true, 11)
on conflict (nome) do nothing;
