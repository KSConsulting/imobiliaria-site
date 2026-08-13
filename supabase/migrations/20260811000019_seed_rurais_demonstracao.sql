-- =====================================================================
-- ImobFlow — 19. Seed de demonstração: 10 chácaras e sítios no interior
-- =====================================================================
--
-- Continuação da migration …018, que trouxe 20 apartamentos na capital.
-- Aqui entram 10 propriedades rurais em Atibaia, Ibiúna, Jarinu, São
-- Roque, Bragança Paulista, Socorro, Itu, Piracicaba, Serra Negra e
-- Holambra, entre venda e locação, metade chácara e metade sítio.
--
-- Existe para que os filtros do site e a busca por características da
-- API tenham o que separar: com estoque de um tipo só, filtrar por tipo
-- devolve sempre a lista inteira e ninguém percebe se o filtro quebrou.
--
-- ⚠️ TODO O CONTEÚDO É FICTÍCIO, pelas mesmas razões da …018.
--   • Estradas, quilômetros, bairros rurais e CEPs são plausíveis, não
--     são imóveis reais
--   • Proprietários e telefones são inventados
--   • As fotos são de banco de imagens e repetem entre os anúncios
--
-- Duas diferenças de preenchimento em relação aos apartamentos, e as
-- duas são de propósito:
--   • `valor_condominio` só existe nas chácaras em condomínio fechado.
--     Sítio aberto não tem condomínio, e zero ali diria "tem, e é de
--     graça"; o campo fica nulo, e a vitrine simplesmente não mostra
--   • `valor_iptu` idem. Sítio paga ITR, que é outro imposto e não tem
--     campo neste sistema. Preencher o IPTU com o ITR seria informação
--     errada numa etiqueta certa
--
-- PARA REMOVER SÓ ESTE LOTE:
--   delete from public.imoveis where id::text like 'a5e20000-%';
-- PARA REMOVER TODA A DEMONSTRAÇÃO (apartamentos e rurais):
--   delete from public.imoveis
--    where id::text like 'a5e10000-%' or id::text like 'a5e20000-%';
-- =====================================================================

do $$
declare
  v_chacara uuid;
  v_sitio   uuid;
begin
  select id into v_chacara from public.tipos_imovel where nome = 'Chácara' limit 1;
  select id into v_sitio   from public.tipos_imovel where nome = 'Sítio'   limit 1;

  if v_chacara is null or v_sitio is null then
    raise exception
      'Tipos "Chácara" e/ou "Sítio" não encontrados em tipos_imovel. Aplique a migration de seed (…011) antes desta.';
  end if;

  insert into public.imoveis (
    id, titulo, descricao, id_tipo_imovel, finalidade, status,
    cep, endereco, numero, complemento, bairro, cidade, estado,
    valor_venda, valor_aluguel, valor_condominio, valor_iptu,
    area_total, area_util, quartos, suites, banheiros, vagas,
    mobiliado, aceita_pet, caracteristicas,
    proprietario_nome, proprietario_contato
  ) values

  ('a5e20000-0000-4000-8000-000000000001',
   'Chácara de 5.000 m² com piscina e pomar em Atibaia',
   'Terreno plano e todo cercado, com sede de quatro dormitórios, varanda ampla e piscina aquecida. Pomar formado de laranja, acerola e goiaba, além de horta e poço artesiano. Fica a 15 minutos do centro de Atibaia, por estrada asfaltada até a porteira.',
   v_chacara, 'venda', 'ativo',
   '12945-000', 'Estrada Municipal dos Pires', 'km 4', 'Chácara 12', 'Bairro dos Pires', 'Atibaia', 'SP',
   1200000, null, 480, 320,
   5000, 280, 4, 2, 4, 6,
   false, true,
   '["Piscina","Churrasqueira","Pomar","Poço artesiano","Horta","Casa de caseiro","Forno de pizza","Portaria 24h"]'::jsonb,
   'Nelson Kawamura', '(11) 90000-0021'),

  ('a5e20000-0000-4000-8000-000000000002',
   'Chácara de 3.000 m² em Ibiúna, pronta para morar',
   'Sede de três dormitórios com lareira, cozinha caipira e varanda com vista para o vale. Área de mata preservada nos fundos e nascente própria. Boa opção para quem quer sair da capital sem se afastar demais.',
   v_chacara, 'venda', 'ativo',
   '18150-000', 'Estrada do Carmo', 'km 8', 'Sítio 7', 'Bairro do Carmo', 'Ibiúna', 'SP',
   680000, null, null, 180,
   3000, 190, 3, 1, 2, 4,
   false, true,
   '["Churrasqueira","Nascente","Área de mata","Pomar","Lareira","Poço artesiano"]'::jsonb,
   'Sônia Regina Barreto', '(11) 90000-0022'),

  ('a5e20000-0000-4000-8000-000000000003',
   'Chácara de 4.800 m² para alugar em Jarinu, em condomínio fechado',
   'Condomínio com portaria 24 horas, lago para pesca e campo de futebol. A sede tem três dormitórios, sendo uma suíte, piscina com deck e churrasqueira coberta. Aluguel mensal, com contrato de no mínimo 12 meses.',
   v_chacara, 'locacao', 'ativo',
   '13240-000', 'Estrada Municipal Ponunduva', 'km 3', 'Lote 44', 'Ponunduva', 'Jarinu', 'SP',
   null, 6500, 890, 260,
   4800, 240, 3, 1, 3, 6,
   true, true,
   '["Piscina","Churrasqueira","Portaria 24h","Lago","Campo de futebol","Salão de festas","Poço artesiano"]'::jsonb,
   'Aparecido Nogueira', '(11) 90000-0023'),

  ('a5e20000-0000-4000-8000-000000000004',
   'Sítio de 4,8 hectares com vinhedo em São Roque',
   'Propriedade produtiva na rota do vinho, com vinhedo formado, adega e sede colonial de quatro dormitórios. Tem casa de caseiro separada, galpão e energia trifásica. Documentação regular, com georreferenciamento em dia.',
   v_sitio, 'venda', 'ativo',
   '18130-000', 'Estrada do Vinho', 'km 11', null, 'Canguera', 'São Roque', 'SP',
   2400000, null, null, null,
   48000, 380, 4, 2, 4, 8,
   false, true,
   '["Vinhedo","Adega","Galpão","Casa de caseiro","Energia trifásica","Poço artesiano","Pomar","Churrasqueira"]'::jsonb,
   'Giuseppe Menegatti', '(11) 90000-0024'),

  ('a5e20000-0000-4000-8000-000000000005',
   'Sítio de 7,2 hectares com lago e curral em Bragança Paulista',
   'Terra boa para pecuária leiteira, com pasto formado, curral coberto e dois lagos abastecidos por nascente. Sede de três dormitórios com varanda em volta e casa de caseiro nos fundos. Acesso por estrada de terra bem conservada, a 9 km do asfalto.',
   v_sitio, 'venda', 'ativo',
   '12929-000', 'Estrada Municipal de Guaripocaba', 'km 9', null, 'Guaripocaba', 'Bragança Paulista', 'SP',
   1850000, null, null, null,
   72000, 260, 3, 1, 3, 6,
   false, true,
   '["Lago","Nascente","Curral","Casa de caseiro","Pasto formado","Energia trifásica","Churrasqueira","Pomar"]'::jsonb,
   'Dirce Salgado', '(11) 90000-0025'),

  ('a5e20000-0000-4000-8000-000000000006',
   'Sítio de 12 hectares com cachoeira em Socorro',
   'Área com relevo de morro, mata nativa preservada e cachoeira dentro da propriedade. A sede tem cinco dormitórios e foi reformada em 2024, com energia solar instalada. Boa para turismo rural, com licença de hospedagem já concedida.',
   v_sitio, 'venda', 'ativo',
   '13960-000', 'Estrada dos Mendes', 'km 14', null, 'Bairro dos Mendes', 'Socorro', 'SP',
   2900000, null, null, null,
   120000, 460, 5, 3, 5, 10,
   false, true,
   '["Cachoeira","Nascente","Área de mata","Energia solar","Casa de caseiro","Piscina","Churrasqueira","Forno de pizza"]'::jsonb,
   'Ivo Bernardes', '(11) 90000-0026'),

  ('a5e20000-0000-4000-8000-000000000007',
   'Chácara de 6.500 m² com campo e piscina em Itu',
   'Sede térrea de quatro dormitórios, com sala de estar integrada à varanda gourmet e piscina de 8 por 4 metros. Campo de futebol com grama batida, quiosque com forno de pizza e pomar. A 12 minutos do centro de Itu.',
   v_chacara, 'venda', 'ativo',
   '13312-000', 'Estrada Rio Acima', 'km 6', 'Chácara 31', 'Bairro Rio Acima', 'Itu', 'SP',
   1450000, null, null, 340,
   6500, 310, 4, 2, 4, 8,
   false, true,
   '["Piscina","Campo de futebol","Forno de pizza","Churrasqueira","Pomar","Varanda gourmet","Poço artesiano"]'::jsonb,
   'Marta Villaça', '(11) 90000-0027'),

  ('a5e20000-0000-4000-8000-000000000008',
   'Sítio de 9,5 hectares para arrendamento em Piracicaba',
   'Área plana e mecanizável, com histórico de cana e milho, dividida em quatro talhões. Tem galpão de máquinas, silo e poço artesiano com boa vazão. Disponível para arrendamento, com valor mensal e contrato mínimo de três safras.',
   v_sitio, 'locacao', 'ativo',
   '13420-000', 'Estrada Municipal de Ártemis', 'km 17', null, 'Ártemis', 'Piracicaba', 'SP',
   null, 8000, null, null,
   95000, 220, 3, 1, 2, 6,
   false, true,
   '["Galpão","Silo","Poço artesiano","Energia trifásica","Área mecanizável","Casa de caseiro"]'::jsonb,
   'Otávio Bertolucci', '(11) 90000-0028'),

  ('a5e20000-0000-4000-8000-000000000009',
   'Chácara de 3.500 m² para alugar em Serra Negra',
   'Casa de campo mobiliada, com três dormitórios, lareira e varanda coberta de frente para a serra. Piscina, churrasqueira e horta em produção. Alugada por mês, com água, jardinagem e limpeza da piscina inclusas.',
   v_chacara, 'locacao', 'ativo',
   '13930-000', 'Estrada dos Lopes', 'km 5', 'Chácara 9', 'Bairro dos Lopes', 'Serra Negra', 'SP',
   null, 4200, null, 190,
   3500, 210, 3, 1, 3, 4,
   true, true,
   '["Piscina","Churrasqueira","Lareira","Horta","Pomar","Poço artesiano"]'::jsonb,
   'Rita de Cássia Amorim', '(11) 90000-0029'),

  ('a5e20000-0000-4000-8000-000000000010',
   'Sítio de 6 hectares com estufas em Holambra',
   'Propriedade voltada à floricultura, com três estufas montadas, sistema de irrigação por gotejamento e reservatório de 200 mil litros. A sede tem quatro dormitórios e fica separada da área produtiva. Documentação regular e acesso asfaltado até a entrada.',
   v_sitio, 'venda', 'ativo',
   '13825-000', 'Estrada Municipal Camanducaia', 'km 7', null, 'Camanducaia', 'Holambra', 'SP',
   1980000, null, null, null,
   60000, 300, 4, 2, 3, 8,
   false, true,
   '["Estufas","Irrigação","Reservatório","Galpão","Energia trifásica","Casa de caseiro","Pomar"]'::jsonb,
   'Willem Van Dijk', '(11) 90000-0030')

  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- Fotos: três por imóvel, na ordem sede, lazer e terreno.
-- ---------------------------------------------------------------------
-- Mesmo arranjo da …018, com um conjunto próprio: sede de campo, área
-- de lazer e paisagem rural. A segunda foto sai do mesmo conjunto da
-- capa, com deslocamento de 3, para que nenhum anúncio mostre a mesma
-- imagem duas vezes.
with pool as (
  select
    array[
      'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=70',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=70',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=70',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=70',
      'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=70',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=70',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=70'
    ] as sedes,
    array[
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=70',
      'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1200&q=70',
      'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=70'
    ] as terrenos
),
alvo as (
  select id, (row_number() over (order by id)) - 1 as n
  from public.imoveis
  where id::text like 'a5e20000-%'
)
insert into public.imoveis_fotos (id_imovel, url, ordem, capa)
select a.id, f.url, f.ordem, f.capa
from alvo a
cross join pool p
cross join lateral (
            select p.sedes[(a.n % 7) + 1]       as url, 0 as ordem, true  as capa
  union all select p.sedes[((a.n + 3) % 7) + 1],         1,         false
  union all select p.terrenos[(a.n % 3) + 1],            2,         false
) as f
where not exists (
  select 1 from public.imoveis_fotos ff where ff.id_imovel = a.id
);
