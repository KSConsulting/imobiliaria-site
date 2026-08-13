-- =====================================================================
-- ImobFlow — 18. Seed de demonstração: 20 apartamentos em São Paulo
-- =====================================================================
--
-- Vinte apartamentos na capital paulista, distribuídos por Moema,
-- Brooklin, Santo Amaro, Tatuapé, Penha e Casa Verde, entre venda,
-- locação e os dois. Existe para que o painel, a vitrine, o Dashboard e
-- a API do agente de IA possam ser vistos com estoque de verdade, em vez
-- de com telas vazias.
--
-- ⚠️ TODO O CONTEÚDO É FICTÍCIO.
--   • Endereços, números e CEPs são plausíveis, não são imóveis reais
--   • Proprietários e telefones são inventados, no formato (11) 90000-00XX
--   • As fotos são de banco de imagens e REPETEM entre os anúncios;
--     ilustram o layout, não os imóveis
--
-- Por isso: **não aplique isto num sistema que já esteja divulgado ao
-- público.** Salvar aqui é publicar na vitrine no mesmo instante, e o
-- visitante não tem como saber que o anúncio é de demonstração.
--
-- PARA REMOVER TUDO, numa linha (as fotos saem em cascata):
--   delete from public.imoveis where id::text like 'a5e10000-%';
--
-- Os ids são fixos e começam com `a5e10000` justamente para que a
-- limpeza seja possível sem caçar registro por registro. O `codigo`
-- IMV-XXXX, esse sim, é gerado pelo trigger 2, como manda a regra.
-- =====================================================================

do $$
declare
  v_tipo uuid;
begin
  select id into v_tipo from public.tipos_imovel where nome = 'Apartamento' limit 1;

  if v_tipo is null then
    raise exception
      'Tipo "Apartamento" não encontrado em tipos_imovel. Aplique a migration de seed (…011) antes desta.';
  end if;

  insert into public.imoveis (
    id, titulo, descricao, id_tipo_imovel, finalidade, status,
    cep, endereco, numero, complemento, bairro, cidade, estado,
    valor_venda, valor_aluguel, valor_condominio, valor_iptu,
    area_total, area_util, quartos, suites, banheiros, vagas,
    mobiliado, aceita_pet, caracteristicas,
    proprietario_nome, proprietario_contato
  ) values

  -- ------------------------------------------------------------------
  -- MOEMA
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000001',
   'Apartamento de 3 dormitórios com varanda gourmet em Moema',
   'Apartamento reformado em rua arborizada de Moema, a poucos quarteirões do Parque Ibirapuera. A sala se integra à varanda gourmet e recebe sol da manhã. Suíte com armários planejados e cozinha completa. O prédio tem portaria 24 horas, piscina e academia.',
   v_tipo, 'venda', 'ativo',
   '04090-002', 'Alameda dos Nhambiquaras', '1240', 'Apto 82', 'Moema', 'São Paulo', 'SP',
   1450000, null, 1450, 480,
   112, 98, 3, 1, 2, 2,
   false, true,
   '["Varanda gourmet","Piscina","Academia","Portaria 24h","Salão de festas","Armários planejados","Elevador"]'::jsonb,
   'Helena Vasconcelos', '(11) 90000-0001'),

  ('a5e10000-0000-4000-8000-000000000002',
   'Apartamento mobiliado de 2 dormitórios na Avenida Moaci',
   'Pronto para morar, entregue com todos os móveis e eletrodomésticos. Fica a cinco minutos a pé do metrô Moema e do comércio da Avenida Ibirapuera. Ideal para quem chega à cidade e não quer montar casa.',
   v_tipo, 'locacao', 'ativo',
   '04083-001', 'Avenida Moaci', '395', 'Apto 54', 'Moema', 'São Paulo', 'SP',
   null, 6200, 980, 260,
   78, 68, 2, 1, 2, 1,
   true, true,
   '["Elevador","Portaria 24h","Academia","Ar-condicionado","Armários planejados","Área de serviço"]'::jsonb,
   'Rodrigo Sampaio', '(11) 90000-0002'),

  ('a5e10000-0000-4000-8000-000000000003',
   'Apartamento de 4 dormitórios com 2 suítes em Moema Pássaros',
   'Andar alto com vista livre para o Ibirapuera, em prédio de apenas dois apartamentos por andar. Living em três ambientes, lavabo, cozinha com despensa e dependência completa. Três vagas cobertas e demarcadas.',
   v_tipo, 'venda', 'ativo',
   '04524-001', 'Alameda dos Arapanés', '812', 'Apto 141', 'Moema', 'São Paulo', 'SP',
   2350000, null, 2300, 890,
   205, 180, 4, 2, 4, 3,
   false, true,
   '["Piscina","Academia","Salão de festas","Portaria 24h","Churrasqueira","Elevador","Playground","Aquecimento solar"]'::jsonb,
   'Beatriz Portela', '(11) 90000-0003'),

  ('a5e10000-0000-4000-8000-000000000004',
   'Apartamento de 1 dormitório mobiliado na Rua Canário',
   'Planta compacta e bem resolvida, com cozinha americana e sacada. O condomínio tem lavanderia coletiva, coworking e portaria eletrônica. Uma vaga coberta inclusa.',
   v_tipo, 'locacao', 'ativo',
   '04521-002', 'Rua Canário', '640', 'Apto 33', 'Moema', 'São Paulo', 'SP',
   null, 3900, 720, 180,
   48, 42, 1, 0, 1, 1,
   true, true,
   '["Elevador","Ar-condicionado","Armários planejados","Coworking","Portaria eletrônica"]'::jsonb,
   'Marcos Aurélio Freitas', '(11) 90000-0004'),

  -- ------------------------------------------------------------------
  -- BROOKLIN
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000005',
   'Apartamento de 3 dormitórios com suíte no Brooklin',
   'Prédio recente em rua tranquila do Brooklin Novo, perto dos escritórios da Avenida Berrini. Sala com dois ambientes e varanda, cozinha integrada e suíte com closet. Lazer completo no térreo.',
   v_tipo, 'venda', 'ativo',
   '04602-003', 'Rua Barão do Triunfo', '1520', 'Apto 91', 'Brooklin', 'São Paulo', 'SP',
   1180000, null, 1150, 390,
   105, 92, 3, 1, 2, 2,
   false, true,
   '["Piscina","Academia","Churrasqueira","Portaria 24h","Salão de festas","Elevador","Varanda gourmet"]'::jsonb,
   'Camila Andrade', '(11) 90000-0005'),

  ('a5e10000-0000-4000-8000-000000000006',
   'Apartamento de 2 dormitórios para alugar na Rua Nebraska',
   'Reformado, com piso vinílico novo e cozinha planejada. Fica a dez minutos a pé da estação Campo Belo do metrô. Aceita pets de pequeno porte.',
   v_tipo, 'locacao', 'ativo',
   '04560-011', 'Rua Nebraska', '285', 'Apto 46', 'Brooklin', 'São Paulo', 'SP',
   null, 4300, 890, 210,
   70, 62, 2, 0, 1, 1,
   false, true,
   '["Elevador","Portaria 24h","Área de serviço","Armários planejados"]'::jsonb,
   'Eduardo Nakamura', '(11) 90000-0006'),

  ('a5e10000-0000-4000-8000-000000000007',
   'Apartamento de 3 dormitórios no Brooklin, para venda ou locação',
   'Disponível nas duas modalidades. Sala ampla com sacada, três dormitórios com armários e duas vagas livres. O condomínio tem quadra, salão de festas e brinquedoteca.',
   v_tipo, 'ambos', 'ativo',
   '04566-001', 'Rua Michigan', '730', 'Apto 112', 'Brooklin', 'São Paulo', 'SP',
   980000, 5100, 1020, 340,
   96, 84, 3, 1, 2, 2,
   false, true,
   '["Quadra poliesportiva","Salão de festas","Playground","Portaria 24h","Elevador","Churrasqueira"]'::jsonb,
   'Patrícia Lemos', '(11) 90000-0007'),

  -- ------------------------------------------------------------------
  -- SANTO AMARO
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000008',
   'Apartamento de 2 dormitórios com suíte em Santo Amaro',
   'Próximo ao Largo Treze e à estação Santo Amaro. Sala com varanda envidraçada, suíte com armários e cozinha com armários planejados. Uma vaga coberta.',
   v_tipo, 'venda', 'ativo',
   '04734-002', 'Avenida Adolfo Pinheiro', '1890', 'Apto 67', 'Santo Amaro', 'São Paulo', 'SP',
   720000, null, 780, 250,
   84, 74, 2, 1, 2, 1,
   false, false,
   '["Elevador","Portaria 24h","Salão de festas","Área de serviço","Armários planejados"]'::jsonb,
   'Sérgio Bittencourt', '(11) 90000-0008'),

  ('a5e10000-0000-4000-8000-000000000009',
   'Apartamento de 3 dormitórios para alugar em Santo Amaro',
   'Planta familiar, com sala em dois ambientes, três dormitórios e área de serviço separada. Duas vagas cobertas. A menos de um quilômetro de escolas e do Shopping Santo Amaro.',
   v_tipo, 'locacao', 'ativo',
   '04752-005', 'Rua Amador Bueno', '455', 'Apto 23', 'Santo Amaro', 'São Paulo', 'SP',
   null, 3800, 940, 290,
   100, 88, 3, 1, 2, 2,
   false, true,
   '["Piscina","Playground","Portaria 24h","Elevador","Churrasqueira","Área de serviço"]'::jsonb,
   'Luciana Prado', '(11) 90000-0009'),

  ('a5e10000-0000-4000-8000-000000000010',
   'Apartamento de 3 dormitórios com lazer completo em Santo Amaro',
   'Condomínio clube com piscina aquecida, quadra e espaço gourmet. O apartamento tem sala com varanda gourmet, suíte com closet e cozinha integrada. Duas vagas cobertas e depósito privativo.',
   v_tipo, 'venda', 'ativo',
   '04743-020', 'Rua Promotor Gabriel Nettuzzi Perez', '210', 'Apto 154', 'Santo Amaro', 'São Paulo', 'SP',
   1050000, null, 1100, 420,
   118, 105, 3, 1, 3, 2,
   false, true,
   '["Piscina","Academia","Quadra poliesportiva","Varanda gourmet","Portaria 24h","Salão de festas","Elevador","Playground"]'::jsonb,
   'Ricardo Monteiro', '(11) 90000-0010'),

  -- ------------------------------------------------------------------
  -- TATUAPÉ
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000011',
   'Apartamento de 3 dormitórios com suíte no Tatuapé',
   'A três quadras da estação Carrão do metrô. Sala com sacada, suíte com armários e cozinha planejada. Prédio com piscina, academia e portaria 24 horas.',
   v_tipo, 'venda', 'ativo',
   '03318-000', 'Rua Serra de Bragança', '1105', 'Apto 74', 'Tatuapé', 'São Paulo', 'SP',
   890000, null, 890, 300,
   98, 86, 3, 1, 2, 2,
   false, true,
   '["Piscina","Academia","Portaria 24h","Elevador","Salão de festas","Armários planejados"]'::jsonb,
   'Fernanda Quintela', '(11) 90000-0011'),

  ('a5e10000-0000-4000-8000-000000000012',
   'Apartamento de 2 dormitórios para alugar na Rua Emília Marengo',
   'Bem conservado, com piso frio, cozinha com armários e área de serviço independente. Uma vaga. A poucos minutos do Shopping Metrô Tatuapé e da estação.',
   v_tipo, 'locacao', 'ativo',
   '03336-000', 'Rua Emília Marengo', '340', 'Apto 38', 'Tatuapé', 'São Paulo', 'SP',
   null, 2900, 720, 180,
   66, 58, 2, 0, 1, 1,
   false, true,
   '["Elevador","Portaria 24h","Área de serviço","Playground"]'::jsonb,
   'Antônio Carlos Ribeiro', '(11) 90000-0012'),

  ('a5e10000-0000-4000-8000-000000000013',
   'Apartamento de 4 dormitórios com 2 suítes no Tatuapé',
   'Andar alto, sol da manhã e vista livre. Living em três ambientes com varanda gourmet fechada, quatro dormitórios sendo duas suítes, lavabo e dependência completa. Três vagas cobertas.',
   v_tipo, 'venda', 'ativo',
   '03307-002', 'Rua Tuiuti', '2180', 'Apto 161', 'Tatuapé', 'São Paulo', 'SP',
   1390000, null, 1480, 560,
   160, 142, 4, 2, 4, 3,
   false, true,
   '["Varanda gourmet","Piscina","Academia","Salão de festas","Quadra poliesportiva","Portaria 24h","Elevador","Churrasqueira"]'::jsonb,
   'Vera Lúcia Domingues', '(11) 90000-0013'),

  ('a5e10000-0000-4000-8000-000000000014',
   'Apartamento de 1 dormitório mobiliado no Tatuapé',
   'Studio mobiliado, entregue com cama, sofá, mesa e eletrodomésticos. Cozinha americana e sacada. Uma vaga coberta. Contas de água e gás inclusas no condomínio.',
   v_tipo, 'locacao', 'ativo',
   '03089-000', 'Rua Antônio de Barros', '890', 'Apto 27', 'Tatuapé', 'São Paulo', 'SP',
   null, 2400, 650, 140,
   50, 45, 1, 0, 1, 1,
   true, false,
   '["Elevador","Ar-condicionado","Portaria eletrônica","Coworking","Armários planejados"]'::jsonb,
   'Juliana Rocha', '(11) 90000-0014'),

  -- ------------------------------------------------------------------
  -- PENHA
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000015',
   'Apartamento de 2 dormitórios na Penha, com uma vaga',
   'Bom para primeira compra. Sala com sacada, dois dormitórios com armários e cozinha com armários planejados. A dez minutos a pé da estação Penha do metrô.',
   v_tipo, 'venda', 'ativo',
   '03634-010', 'Rua Doutor João Ribeiro', '615', 'Apto 42', 'Penha', 'São Paulo', 'SP',
   420000, null, 520, 150,
   62, 56, 2, 0, 1, 1,
   false, true,
   '["Elevador","Portaria 24h","Playground","Área de serviço"]'::jsonb,
   'Marcelo Tavares', '(11) 90000-0015'),

  ('a5e10000-0000-4000-8000-000000000016',
   'Apartamento de 3 dormitórios para alugar na Penha de França',
   'Planta ampla, sala em dois ambientes e três dormitórios. Área de serviço com quintal de apoio. Uma vaga descoberta. Comércio e escolas na mesma quadra.',
   v_tipo, 'locacao', 'ativo',
   '03606-000', 'Avenida Penha de França', '1320', 'Apto 96', 'Penha', 'São Paulo', 'SP',
   null, 2600, 610, 190,
   82, 72, 3, 0, 2, 1,
   false, true,
   '["Elevador","Portaria 24h","Salão de festas","Área de serviço","Churrasqueira"]'::jsonb,
   'Rosana Figueiredo', '(11) 90000-0016'),

  ('a5e10000-0000-4000-8000-000000000017',
   'Apartamento de 2 dormitórios na Penha, para venda ou locação',
   'Disponível para compra ou aluguel. Reformado, com cozinha planejada e banheiro novo. Prédio com portaria 24 horas e salão de festas. Aceita pets.',
   v_tipo, 'ambos', 'ativo',
   '03621-000', 'Rua Coroatá', '275', 'Apto 51', 'Penha', 'São Paulo', 'SP',
   495000, 2300, 580, 170,
   72, 64, 2, 1, 2, 1,
   false, true,
   '["Elevador","Portaria 24h","Salão de festas","Armários planejados","Playground"]'::jsonb,
   'Gilberto Assunção', '(11) 90000-0017'),

  -- ------------------------------------------------------------------
  -- CASA VERDE
  -- ------------------------------------------------------------------
  ('a5e10000-0000-4000-8000-000000000018',
   'Apartamento de 3 dormitórios com suíte na Casa Verde',
   'Prédio novo na Avenida Casa Verde, com fácil acesso à Marginal Tietê e à Ponte da Casa Verde. Sala com varanda, suíte e duas vagas cobertas. Lazer com piscina e academia.',
   v_tipo, 'venda', 'ativo',
   '02519-000', 'Avenida Casa Verde', '2450', 'Apto 118', 'Casa Verde', 'São Paulo', 'SP',
   640000, null, 690, 220,
   88, 78, 3, 1, 2, 2,
   false, true,
   '["Piscina","Academia","Portaria 24h","Elevador","Salão de festas","Varanda gourmet"]'::jsonb,
   'Tânia Bertoldo', '(11) 90000-0018'),

  ('a5e10000-0000-4000-8000-000000000019',
   'Apartamento de 2 dormitórios para alugar na Casa Verde',
   'Andar intermediário, claro e ventilado. Dois dormitórios com armários, cozinha com armários e área de serviço. Uma vaga. Ponto de ônibus e mercado na esquina.',
   v_tipo, 'locacao', 'ativo',
   '02516-030', 'Rua Marcos Arruda', '180', 'Apto 34', 'Casa Verde', 'São Paulo', 'SP',
   null, 2450, 640, 160,
   68, 60, 2, 0, 1, 1,
   false, true,
   '["Elevador","Portaria 24h","Área de serviço","Playground","Churrasqueira"]'::jsonb,
   'Wagner Delgado', '(11) 90000-0019'),

  ('a5e10000-0000-4000-8000-000000000020',
   'Apartamento de 2 dormitórios com sacada na Casa Verde Alta',
   'Planta compacta e bem aproveitada, com sacada integrada à sala. Cozinha com armários planejados e banheiro reformado. Uma vaga coberta. Condomínio de valor baixo.',
   v_tipo, 'venda', 'ativo',
   '02522-000', 'Rua Sebastião Antunes', '95', 'Apto 22', 'Casa Verde', 'São Paulo', 'SP',
   468000, null, 560, 145,
   58, 52, 2, 0, 1, 1,
   false, false,
   '["Elevador","Portaria eletrônica","Área de serviço","Armários planejados"]'::jsonb,
   'Cláudia Meireles', '(11) 90000-0020')

  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- Fotos: três por imóvel, na ordem capa, cozinha e dormitório.
-- ---------------------------------------------------------------------
-- As imagens são de banco (Unsplash) e são servidas de fora do Storage
-- do projeto. Isso funciona porque `urlDaFoto`, em src/lib/publico.ts,
-- devolve a URL intacta quando ela não é do Storage, em vez de tentar
-- redimensioná-la.
--
-- Elas se repetem entre os anúncios de propósito: o conjunto é pequeno,
-- e o objetivo aqui é a tela ficar completa, não parecer um estoque
-- fotografado. Ao substituir por fotos reais, suba pelo painel, que é o
-- caminho que comprime a imagem e grava no bucket `imoveis`.
with pool as (
  select
    array[
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=70',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=70',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=70',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=70',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=70',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=70',
      'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=1200&q=70',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=70',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=70'
    ] as salas,
    array[
      'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1200&q=70',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=70'
    ] as cozinhas,
    array[
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=1200&q=70',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&q=70'
    ] as quartos
),
alvo as (
  -- Ordena por id, e não por codigo: os ids são fixos nesta migration,
  -- enquanto o codigo depende de onde a sequence estava ao aplicar.
  select id, (row_number() over (order by id)) - 1 as n
  from public.imoveis
  where id::text like 'a5e10000-%'
)
insert into public.imoveis_fotos (id_imovel, url, ordem, capa)
select a.id, f.url, f.ordem, f.capa
from alvo a
cross join pool p
cross join lateral (
            select p.salas[(a.n % 9) + 1]    as url, 0 as ordem, true  as capa
  union all select p.cozinhas[(a.n % 2) + 1],         1,         false
  union all select p.quartos[(a.n % 2) + 1],          2,         false
) as f
-- Idempotente: rodar duas vezes não duplica a galeria nem esbarra no
-- trigger de limite de 10 fotos.
where not exists (
  select 1 from public.imoveis_fotos ff where ff.id_imovel = a.id
);
