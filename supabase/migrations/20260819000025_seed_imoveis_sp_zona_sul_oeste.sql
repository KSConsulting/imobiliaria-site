-- =====================================================================
-- ImobFlow — 25. Seed de demonstração: 30 imóveis (capital + interior)
-- =====================================================================
--
-- Trinta imóveis pedidos para avaliar o sistema com estoque de verdade:
--
--   15 apartamentos para LOCAÇÃO   — São Paulo, zona sul e zona oeste
--   10 apartamentos para VENDA     — São Paulo, zona sul e zona oeste
--    5 casas para VENDA            — interior de São Paulo
--
-- ⚠️ TODO O CONTEÚDO É FICTÍCIO.
--   • Ruas, números e CEPs são plausíveis e ficam nos bairros que
--     nomeiam, mas não correspondem a imóveis reais
--   • Proprietários e telefones são inventados, no formato (11) 9xxxx-xxxx
--   • As fotos são de banco de imagens e REPETEM entre os anúncios;
--     ilustram o layout, não os imóveis
--
-- Por isso: **não aplique isto num sistema já divulgado ao público.**
-- Salvar aqui é publicar na vitrine no mesmo instante, e o visitante não
-- tem como saber que o anúncio é de demonstração.
--
-- PARA REMOVER TUDO, numa linha (as fotos saem em cascata):
--   delete from public.imoveis where id::text like 'a5e30000-%';
--
-- O prefixo `a5e30000` é próprio deste lote, distinto do `a5e10000` das
-- migrations 018 e 019, para que um possa ser removido sem levar o
-- outro. O `codigo` IMV-XXXX é gerado pelo trigger, como manda a regra.
-- =====================================================================

do $$
declare
  v_apto uuid;
  v_casa uuid;
begin
  select id into v_apto from public.tipos_imovel where nome = 'Apartamento' limit 1;
  select id into v_casa from public.tipos_imovel where nome = 'Casa'        limit 1;

  if v_apto is null or v_casa is null then
    raise exception
      'Tipos "Apartamento" e/ou "Casa" não encontrados em tipos_imovel. Aplique a migration de seed (…011) antes desta.';
  end if;

  insert into public.imoveis (
    id, titulo, descricao, id_tipo_imovel, finalidade, status,
    cep, endereco, numero, complemento, bairro, cidade, estado,
    valor_venda, valor_aluguel, valor_condominio, valor_iptu,
    area_total, area_util, quartos, suites, banheiros, vagas,
    mobiliado, aceita_pet, caracteristicas,
    proprietario_nome, proprietario_contato
  ) values

  -- ==================================================================
  -- LOCAÇÃO — ZONA SUL (8 apartamentos)
  -- ==================================================================

  ('a5e30000-0000-4000-8000-000000000001',
   'Apartamento mobiliado de 2 dormitórios a duas quadras do metrô Moema',
   'Entregue completo, com móveis planejados e eletrodomésticos. A sala dá para uma varanda com vista para rua arborizada, e o comércio da Avenida Ibirapuera fica a cinco minutos a pé. Prédio com portaria 24 horas e academia. Indicado para quem chega à cidade e não quer montar casa.',
   v_apto, 'locacao', 'ativo',
   '04077-020', 'Alameda dos Anapurus', '735', 'Apto 61', 'Moema', 'São Paulo', 'SP',
   null, 6800, 1180, 310,
   82, 72, 2, 1, 2, 1,
   true, true,
   '["Mobiliado","Varanda","Academia","Portaria 24h","Elevador","Armários planejados"]'::jsonb,
   'Helena Vasconcelos', '(11) 97001-0001'),

  ('a5e30000-0000-4000-8000-000000000002',
   'Apartamento de 1 dormitório na Vila Mariana, próximo ao metrô Ana Rosa',
   'Planta compacta e bem resolvida, com sala integrada à cozinha e dormitório com armário embutido. Fica em rua tranquila a sete minutos do metrô Ana Rosa. Prédio novo, com lavanderia coletiva e bicicletário.',
   v_apto, 'locacao', 'ativo',
   '04116-030', 'Rua Joaquim Távora', '482', 'Apto 34', 'Vila Mariana', 'São Paulo', 'SP',
   null, 3400, 620, 145,
   42, 38, 1, 0, 1, 1,
   false, true,
   '["Bicicletário","Lavanderia coletiva","Elevador","Portaria 24h"]'::jsonb,
   'Ricardo Salgado', '(11) 97001-0002'),

  ('a5e30000-0000-4000-8000-000000000003',
   'Apartamento de 2 dormitórios com suíte no Campo Belo',
   'Andar alto e silencioso, com sol da tarde na sala. Suíte com closet, cozinha planejada e área de serviço separada. O prédio tem piscina coberta e salão de festas, e o Aeroporto de Congonhas fica a dez minutos.',
   v_apto, 'locacao', 'ativo',
   '04609-011', 'Rua Vieira de Morais', '1290', 'Apto 112', 'Campo Belo', 'São Paulo', 'SP',
   null, 5900, 1320, 280,
   88, 76, 2, 1, 2, 2,
   false, true,
   '["Piscina","Salão de festas","Portaria 24h","Elevador","Closet","Área de serviço"]'::jsonb,
   'Marina Toledo', '(11) 97001-0003'),

  ('a5e30000-0000-4000-8000-000000000004',
   'Apartamento de 3 dormitórios com varanda gourmet no Brooklin',
   'Sala em L integrada à varanda gourmet com churrasqueira. Três dormitórios, sendo um suíte, todos com armários. Fica perto do corredor da Avenida Santo Amaro e do polo de escritórios da Berrini.',
   v_apto, 'locacao', 'ativo',
   '04571-010', 'Rua Nebraska', '640', 'Apto 91', 'Brooklin', 'São Paulo', 'SP',
   null, 9200, 1780, 460,
   124, 108, 3, 1, 3, 2,
   false, true,
   '["Varanda gourmet","Churrasqueira","Piscina","Academia","Portaria 24h","Elevador","Armários planejados"]'::jsonb,
   'Otávio Bandeira', '(11) 97001-0004'),

  ('a5e30000-0000-4000-8000-000000000005',
   'Apartamento de 2 dormitórios reformado na Saúde',
   'Reforma recente, com piso vinílico novo e cozinha aberta para a sala. Dois dormitórios com armários e banheiro social reformado. A dois quarteirões do metrô Saúde e do comércio da Rua Vergueiro.',
   v_apto, 'locacao', 'ativo',
   '04144-020', 'Rua Bartolomeu de Gusmão', '318', 'Apto 47', 'Saúde', 'São Paulo', 'SP',
   null, 4200, 740, 190,
   68, 61, 2, 0, 1, 1,
   false, true,
   '["Reformado","Cozinha americana","Elevador","Portaria 24h","Armários planejados"]'::jsonb,
   'Cláudia Rezende', '(11) 97001-0005'),

  ('a5e30000-0000-4000-8000-000000000006',
   'Apartamento de 2 dormitórios em Santo Amaro, com lazer completo',
   'Condomínio com piscina, quadra e playground, indicado para família com criança. O apartamento tem sala ampla, dois dormitórios e dependência reversível. Comércio, escolas e o terminal de ônibus ficam no entorno.',
   v_apto, 'locacao', 'ativo',
   '04743-030', 'Rua Amador Bueno', '905', 'Apto 23', 'Santo Amaro', 'São Paulo', 'SP',
   null, 3900, 890, 165,
   74, 66, 2, 0, 2, 1,
   false, true,
   '["Piscina","Quadra poliesportiva","Playground","Portaria 24h","Elevador"]'::jsonb,
   'Fernando Aguiar', '(11) 97001-0006'),

  ('a5e30000-0000-4000-8000-000000000007',
   'Studio de 1 dormitório na Chácara Santo Antônio',
   'Studio novo em prédio com coworking e academia no térreo, no meio do polo de escritórios da Chácara Santo Antônio. Entregue com cozinha equipada. Aluguel com condomínio enxuto, pensado para quem trabalha na região.',
   v_apto, 'locacao', 'ativo',
   '04717-004', 'Rua Alexandre Dumas', '1620', 'Apto 806', 'Chácara Santo Antônio', 'São Paulo', 'SP',
   null, 3100, 580, 130,
   36, 33, 1, 0, 1, 1,
   true, false,
   '["Mobiliado","Coworking","Academia","Portaria 24h","Elevador"]'::jsonb,
   'Beatriz Nakamura', '(11) 97001-0007'),

  ('a5e30000-0000-4000-8000-000000000008',
   'Apartamento de 3 dormitórios no Jardim Marajoara',
   'Andar intermediário em prédio de poucas unidades por andar, em rua residencial arborizada. Três dormitórios com armários, sendo um suíte, e varanda com churrasqueira. Aceita pet de porte médio.',
   v_apto, 'locacao', 'ativo',
   '04664-002', 'Rua Nicolau Assis', '210', 'Apto 52', 'Jardim Marajoara', 'São Paulo', 'SP',
   null, 7400, 1450, 340,
   116, 102, 3, 1, 3, 2,
   false, true,
   '["Varanda","Churrasqueira","Piscina","Salão de festas","Portaria 24h","Elevador"]'::jsonb,
   'Luciana Prado', '(11) 97001-0008'),

  -- ==================================================================
  -- LOCAÇÃO — ZONA OESTE (7 apartamentos)
  -- ==================================================================

  ('a5e30000-0000-4000-8000-000000000009',
   'Apartamento mobiliado de 2 dormitórios em Pinheiros',
   'A uma quadra da Rua dos Pinheiros e a dez minutos a pé do metrô Fradique Coutinho. Entregue mobiliado, com cozinha equipada e ar-condicionado nos dois dormitórios. Prédio com portaria 24 horas e terraço coletivo.',
   v_apto, 'locacao', 'ativo',
   '05422-011', 'Rua Artur de Azevedo', '1155', 'Apto 74', 'Pinheiros', 'São Paulo', 'SP',
   null, 7200, 1090, 295,
   76, 68, 2, 1, 2, 1,
   true, true,
   '["Mobiliado","Ar-condicionado","Terraço coletivo","Portaria 24h","Elevador"]'::jsonb,
   'Gustavo Ferrari', '(11) 97001-0009'),

  ('a5e30000-0000-4000-8000-000000000010',
   'Apartamento de 1 dormitório na Vila Madalena',
   'No miolo da Vila Madalena, a poucos quarteirões dos bares da Rua Aspicuelta e do metrô Vila Madalena. Pé-direito alto e janelas amplas. Prédio pequeno, sem elevador, com apenas oito unidades.',
   v_apto, 'locacao', 'ativo',
   '05435-010', 'Rua Fidalga', '388', 'Apto 21', 'Vila Madalena', 'São Paulo', 'SP',
   null, 3800, 490, 160,
   45, 41, 1, 0, 1, 0,
   false, true,
   '["Pé-direito alto","Prédio pequeno","Próximo ao metrô"]'::jsonb,
   'Renata Coutinho', '(11) 97001-0010'),

  ('a5e30000-0000-4000-8000-000000000011',
   'Apartamento de 3 dormitórios em Perdizes, próximo à PUC',
   'Apartamento amplo em rua residencial de Perdizes, a dez minutos a pé da PUC. Sala para dois ambientes, três dormitórios com armários e dependência completa. Prédio com portaria 24 horas e playground.',
   v_apto, 'locacao', 'ativo',
   '05014-001', 'Rua Cardoso de Almeida', '2040', 'Apto 83', 'Perdizes', 'São Paulo', 'SP',
   null, 8100, 1520, 380,
   135, 118, 3, 1, 3, 2,
   false, true,
   '["Dependência completa","Playground","Portaria 24h","Elevador","Armários planejados"]'::jsonb,
   'Paulo Meireles', '(11) 97001-0011'),

  ('a5e30000-0000-4000-8000-000000000012',
   'Apartamento de 2 dormitórios no Butantã, perto da USP',
   'A dois quilômetros do campus da USP e a caminhada do metrô Butantã. Dois dormitórios com armários, sala com varanda e cozinha planejada. Condomínio com custo baixo e portaria 24 horas.',
   v_apto, 'locacao', 'ativo',
   '05503-001', 'Rua Alvarenga', '1470', 'Apto 66', 'Butantã', 'São Paulo', 'SP',
   null, 4100, 680, 175,
   66, 59, 2, 0, 2, 1,
   false, true,
   '["Varanda","Cozinha planejada","Portaria 24h","Elevador","Próximo ao metrô"]'::jsonb,
   'Sandra Vilela', '(11) 97001-0012'),

  ('a5e30000-0000-4000-8000-000000000013',
   'Apartamento de 2 dormitórios com lazer na Vila Leopoldina',
   'Condomínio-clube com piscina, academia e quadra, em região que se transformou nos últimos anos. Apartamento com varanda gourmet e duas vagas cobertas. Perto do Ceagesp e do acesso à Marginal Pinheiros.',
   v_apto, 'locacao', 'ativo',
   '05307-001', 'Rua Carlos Weber', '820', 'Apto 128', 'Vila Leopoldina', 'São Paulo', 'SP',
   null, 5600, 1240, 250,
   84, 74, 2, 1, 2, 2,
   false, true,
   '["Varanda gourmet","Piscina","Academia","Quadra poliesportiva","Portaria 24h","Elevador"]'::jsonb,
   'Diego Sampaio', '(11) 97001-0013'),

  ('a5e30000-0000-4000-8000-000000000014',
   'Apartamento de 3 dormitórios na Lapa, em prédio reformado',
   'Prédio com fachada e áreas comuns reformadas, em rua residencial da Lapa. Três dormitórios, sendo um suíte, e sala com varanda. A caminhada da estação Lapa da CPTM e do comércio da Rua Doze de Outubro.',
   v_apto, 'locacao', 'ativo',
   '05077-020', 'Rua Guaicurus', '1105', 'Apto 94', 'Lapa', 'São Paulo', 'SP',
   null, 6300, 980, 265,
   105, 92, 3, 1, 2, 2,
   false, true,
   '["Varanda","Prédio reformado","Portaria 24h","Elevador","Salão de festas"]'::jsonb,
   'Tatiana Borges', '(11) 97001-0014'),

  ('a5e30000-0000-4000-8000-000000000015',
   'Apartamento de 2 dormitórios no Alto de Pinheiros',
   'Rua tranquila do Alto de Pinheiros, a dez minutos do Parque Villa-Lobos. Sala com varanda voltada para o miolo do quarteirão, silenciosa. Dois dormitórios com armários e uma vaga coberta.',
   v_apto, 'locacao', 'ativo',
   '05461-010', 'Rua Vupabussu', '265', 'Apto 41', 'Alto de Pinheiros', 'São Paulo', 'SP',
   null, 6500, 1160, 310,
   90, 80, 2, 1, 2, 1,
   false, true,
   '["Varanda","Portaria 24h","Elevador","Armários planejados","Próximo a parque"]'::jsonb,
   'Henrique Lousada', '(11) 97001-0015'),

  -- ==================================================================
  -- VENDA — ZONA SUL (5 apartamentos)
  -- ==================================================================

  ('a5e30000-0000-4000-8000-000000000016',
   'Apartamento de 3 dormitórios com varanda gourmet em Moema',
   'Apartamento reformado em rua arborizada de Moema, a poucos quarteirões do Parque Ibirapuera. A sala se integra à varanda gourmet e recebe sol da manhã. Suíte com armários planejados e cozinha completa. Prédio com portaria 24 horas, piscina e academia.',
   v_apto, 'venda', 'ativo',
   '04090-002', 'Alameda dos Nhambiquaras', '1240', 'Apto 82', 'Moema', 'São Paulo', 'SP',
   1580000, null, 1450, 480,
   112, 98, 3, 1, 2, 2,
   false, true,
   '["Varanda gourmet","Piscina","Academia","Portaria 24h","Salão de festas","Armários planejados","Elevador"]'::jsonb,
   'Eduardo Assunção', '(11) 97001-0016'),

  ('a5e30000-0000-4000-8000-000000000017',
   'Apartamento de 2 dormitórios na Vila Mariana, a 300 metros do metrô',
   'Andar alto com vista livre, em prédio de 2018. Dois dormitórios com armários, sendo um suíte, e sala integrada à varanda. A 300 metros do metrô Vila Mariana, com comércio e escolas no entorno.',
   v_apto, 'venda', 'ativo',
   '04101-300', 'Rua Sena Madureira', '890', 'Apto 143', 'Vila Mariana', 'São Paulo', 'SP',
   1120000, null, 980, 320,
   72, 64, 2, 1, 2, 1,
   false, true,
   '["Varanda","Vista livre","Academia","Portaria 24h","Elevador","Próximo ao metrô"]'::jsonb,
   'Priscila Damasceno', '(11) 97001-0017'),

  ('a5e30000-0000-4000-8000-000000000018',
   'Apartamento de 4 dormitórios no Campo Belo, com 3 suítes',
   'Apartamento de alto padrão em uma unidade por andar, com hall privativo. Quatro dormitórios, sendo três suítes, sala para três ambientes e varanda com churrasqueira. Quatro vagas e depósito privativo.',
   v_apto, 'venda', 'ativo',
   '04613-002', 'Rua Gabriele D''Annunzio', '410', 'Apto 151', 'Campo Belo', 'São Paulo', 'SP',
   3450000, null, 3200, 1150,
   215, 188, 4, 3, 5, 4,
   false, true,
   '["Hall privativo","Uma unidade por andar","Varanda gourmet","Churrasqueira","Piscina","Academia","Depósito privativo","Portaria 24h"]'::jsonb,
   'Antônio Vilaça', '(11) 97001-0018'),

  ('a5e30000-0000-4000-8000-000000000019',
   'Apartamento de 3 dormitórios no Brooklin, próximo à Berrini',
   'Bem localizado para quem trabalha na Berrini ou na Faria Lima. Três dormitórios com armários planejados, sendo um suíte, e sala com varanda envidraçada. Condomínio com piscina aquecida e espaço gourmet.',
   v_apto, 'venda', 'ativo',
   '04578-000', 'Rua Michigan', '1080', 'Apto 87', 'Brooklin', 'São Paulo', 'SP',
   1890000, null, 1690, 540,
   126, 110, 3, 1, 3, 2,
   false, true,
   '["Varanda envidraçada","Piscina aquecida","Espaço gourmet","Academia","Portaria 24h","Elevador"]'::jsonb,
   'Vanessa Klein', '(11) 97001-0019'),

  ('a5e30000-0000-4000-8000-000000000020',
   'Apartamento de 3 dormitórios no Morumbi, com vista para a mata',
   'Andar alto com vista para área verde preservada. Três dormitórios com suíte máster, sala ampla e varanda profunda. Condomínio arborizado, com quadra, piscina e trilha interna, em terreno de mais de 10 mil metros.',
   v_apto, 'venda', 'ativo',
   '05650-000', 'Avenida Giovanni Gronchi', '4550', 'Apto 174', 'Morumbi', 'São Paulo', 'SP',
   1740000, null, 2100, 610,
   148, 128, 3, 1, 4, 3,
   false, true,
   '["Vista para área verde","Varanda","Piscina","Quadra poliesportiva","Condomínio arborizado","Portaria 24h"]'::jsonb,
   'Rogério Pontes', '(11) 97001-0020'),

  -- ==================================================================
  -- VENDA — ZONA OESTE (5 apartamentos)
  -- ==================================================================

  ('a5e30000-0000-4000-8000-000000000021',
   'Apartamento de 2 dormitórios em Pinheiros, a 400 metros do metrô',
   'Prédio novo em rua arborizada de Pinheiros, com fachada em concreto aparente. Dois dormitórios, sendo um suíte, e sala integrada à cozinha. Rooftop com piscina e vista para a região. A 400 metros do metrô Faria Lima.',
   v_apto, 'venda', 'ativo',
   '05424-020', 'Rua Doutor Virgílio de Carvalho Pinto', '525', 'Apto 92', 'Pinheiros', 'São Paulo', 'SP',
   1650000, null, 1380, 470,
   78, 70, 2, 1, 2, 1,
   false, true,
   '["Rooftop","Piscina","Academia","Coworking","Portaria 24h","Elevador","Próximo ao metrô"]'::jsonb,
   'Camila Bastos', '(11) 97001-0021'),

  ('a5e30000-0000-4000-8000-000000000022',
   'Apartamento de 3 dormitórios em Perdizes, em rua tranquila',
   'Apartamento de planta generosa, típica dos prédios dos anos 90 de Perdizes. Três dormitórios com armários, sendo um suíte, sala para dois ambientes e dependência completa. Duas vagas cobertas e depósito.',
   v_apto, 'venda', 'ativo',
   '05017-030', 'Rua Apiacás', '760', 'Apto 71', 'Perdizes', 'São Paulo', 'SP',
   1560000, null, 1440, 430,
   142, 124, 3, 1, 3, 2,
   false, true,
   '["Dependência completa","Depósito privativo","Salão de festas","Portaria 24h","Elevador","Armários planejados"]'::jsonb,
   'Marcelo Iizuka', '(11) 97001-0022'),

  ('a5e30000-0000-4000-8000-000000000023',
   'Apartamento de 4 dormitórios no Alto de Pinheiros, frente ao parque',
   'Frente para área verde, a uma quadra do Parque Villa-Lobos. Quatro dormitórios, sendo duas suítes, sala para três ambientes com varanda e lareira. Três vagas cobertas. Prédio de duas unidades por andar.',
   v_apto, 'venda', 'ativo',
   '05460-000', 'Avenida Diógenes Ribeiro de Lima', '2180', 'Apto 121', 'Alto de Pinheiros', 'São Paulo', 'SP',
   2980000, null, 2650, 940,
   198, 172, 4, 2, 4, 3,
   false, true,
   '["Frente para parque","Lareira","Varanda","Duas unidades por andar","Piscina","Portaria 24h","Elevador"]'::jsonb,
   'Silvia Monteiro', '(11) 97001-0023'),

  ('a5e30000-0000-4000-8000-000000000024',
   'Apartamento de 2 dormitórios na Vila Leopoldina, em condomínio-clube',
   'Condomínio-clube com piscina, academia, quadra e espaço pet. Apartamento com varanda gourmet, dois dormitórios com armários e duas vagas. Perto do acesso à Marginal Pinheiros e da estação Villa-Lobos-Jaguaré.',
   v_apto, 'venda', 'ativo',
   '05311-020', 'Rua Sargento Lourival Alves de Souza', '340', 'Apto 64', 'Vila Leopoldina', 'São Paulo', 'SP',
   1080000, null, 1150, 330,
   80, 71, 2, 1, 2, 2,
   false, true,
   '["Varanda gourmet","Piscina","Academia","Quadra poliesportiva","Espaço pet","Portaria 24h","Elevador"]'::jsonb,
   'Bruno Carvalhais', '(11) 97001-0024'),

  ('a5e30000-0000-4000-8000-000000000025',
   'Apartamento de 3 dormitórios no Itaim Bibi, a caminhada da Faria Lima',
   'No miolo do Itaim Bibi, a dez minutos a pé da Avenida Faria Lima. Três dormitórios, sendo um suíte com closet, e sala integrada à varanda gourmet. Prédio com concierge, academia e sala de reuniões.',
   v_apto, 'venda', 'ativo',
   '04534-011', 'Rua Joaquim Floriano', '890', 'Apto 132', 'Itaim Bibi', 'São Paulo', 'SP',
   2650000, null, 2380, 820,
   145, 127, 3, 1, 4, 2,
   false, true,
   '["Varanda gourmet","Closet","Concierge","Academia","Sala de reuniões","Portaria 24h","Elevador"]'::jsonb,
   'Isabela Fontenele', '(11) 97001-0025'),

  -- ==================================================================
  -- VENDA — CASAS NO INTERIOR DE SÃO PAULO (5)
  -- ==================================================================

  ('a5e30000-0000-4000-8000-000000000026',
   'Casa de 4 dormitórios em condomínio fechado em Barão Geraldo, Campinas',
   'Casa térrea com pé-direito duplo na sala, em condomínio fechado de Barão Geraldo, perto da Unicamp. Quatro dormitórios, sendo duas suítes, e área gourmet com churrasqueira voltada para o jardim. Terreno de 480 metros com piscina.',
   v_casa, 'venda', 'ativo',
   '13084-970', 'Alameda das Acácias', '145', 'Condomínio Terra Nobre', 'Barão Geraldo', 'Campinas', 'SP',
   1680000, null, 890, 420,
   480, 268, 4, 2, 4, 4,
   false, true,
   '["Piscina","Área gourmet","Churrasqueira","Pé-direito duplo","Jardim","Condomínio fechado","Portaria 24h"]'::jsonb,
   'Nelson Aparecido Ramos', '(19) 97001-0026'),

  ('a5e30000-0000-4000-8000-000000000027',
   'Casa de alto padrão em condomínio de Itu, com 5 suítes',
   'Casa em dois pavimentos num dos condomínios tradicionais de Itu, com campo de golfe e lago. Cinco suítes, sala com lareira e varanda coberta com vista para o jardim. Terreno de 1.100 metros, piscina aquecida e casa de hóspedes.',
   v_casa, 'venda', 'ativo',
   '13301-000', 'Alameda das Palmeiras', '78', 'Condomínio Terras de São José', 'Jardim Theodora', 'Itu', 'SP',
   2780000, null, 1650, 780,
   1100, 420, 5, 5, 6, 6,
   false, true,
   '["Piscina aquecida","Lareira","Casa de hóspedes","Varanda coberta","Campo de golfe","Lago","Condomínio fechado","Portaria 24h"]'::jsonb,
   'Regina Sobral Machado', '(11) 97001-0027'),

  ('a5e30000-0000-4000-8000-000000000028',
   'Casa de 3 dormitórios em condomínio de Valinhos',
   'Casa térrea bem conservada, em condomínio arborizado de Valinhos. Três dormitórios, sendo um suíte, sala integrada à varanda e cozinha com ilha. Terreno de 360 metros com pomar e espaço para piscina.',
   v_casa, 'venda', 'ativo',
   '13273-400', 'Rua das Hortênsias', '92', 'Condomínio Palmeiras Imperiais', 'Jardim Paiquerê', 'Valinhos', 'SP',
   1290000, null, 720, 310,
   360, 195, 3, 1, 3, 3,
   false, true,
   '["Pomar","Cozinha com ilha","Varanda","Condomínio fechado","Portaria 24h","Jardim"]'::jsonb,
   'Wagner Delfino', '(19) 97001-0028'),

  ('a5e30000-0000-4000-8000-000000000029',
   'Casa de campo de 4 dormitórios em Atibaia, com vista para a serra',
   'Casa em terreno de 900 metros com vista para a Pedra Grande. Quatro dormitórios, sendo duas suítes, sala com lareira e varanda ampla para as refeições ao ar livre. A 70 quilômetros da capital pela Fernão Dias.',
   v_casa, 'venda', 'ativo',
   '12947-000', 'Estrada do Rosário', '1450', 'Condomínio Flamboyant', 'Jardim Estância Brasil', 'Atibaia', 'SP',
   1450000, null, 640, 290,
   900, 240, 4, 2, 4, 4,
   false, true,
   '["Vista para a serra","Lareira","Varanda ampla","Jardim","Condomínio fechado","Portaria 24h"]'::jsonb,
   'Marta Yoshida', '(11) 97001-0029'),

  ('a5e30000-0000-4000-8000-000000000030',
   'Casa de 3 dormitórios em condomínio de Sorocaba',
   'Casa em dois pavimentos, entregue com armários planejados em todos os ambientes. Três dormitórios, sendo um suíte com varanda, e área externa com churrasqueira. Condomínio com portaria 24 horas, quadra e trilha.',
   v_casa, 'venda', 'ativo',
   '18052-780', 'Alameda dos Ipês', '305', 'Condomínio Ibiti Reserva', 'Jardim Novo Horizonte', 'Sorocaba', 'SP',
   1150000, null, 780, 265,
   320, 210, 3, 1, 3, 2,
   false, true,
   '["Churrasqueira","Armários planejados","Quadra poliesportiva","Trilha","Condomínio fechado","Portaria 24h"]'::jsonb,
   'Cristiano Bueno', '(15) 97001-0030')

  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Galeria: três fotos por imóvel, de banco de imagens.
-- Apartamentos e casas puxam de conjuntos distintos, para a vitrine não
-- ilustrar casa de condomínio com foto de sala de apartamento.
-- ---------------------------------------------------------------------
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
    ] as salas_apto,
    array[
      'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1200&q=70',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=70',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=70',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=70',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=70'
    ] as fachadas_casa,
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
  -- Ordena por id, que é fixo nesta migration. O codigo depende de onde
  -- a sequence estava no momento em que ela foi aplicada.
  select i.id,
         (row_number() over (order by i.id)) - 1 as n,
         t.nome = 'Casa' as e_casa
    from public.imoveis i
    join public.tipos_imovel t on t.id = i.id_tipo_imovel
   where i.id::text like 'a5e30000-%'
)
insert into public.imoveis_fotos (id_imovel, url, ordem, capa)
select a.id, f.url, f.ordem, f.capa
  from alvo a
  cross join pool p
  cross join lateral (
              select case when a.e_casa
                          then p.fachadas_casa[(a.n % 5) + 1]
                          else p.salas_apto[(a.n % 9) + 1]
                     end                        as url, 0 as ordem, true  as capa
    union all select p.cozinhas[(a.n % 2) + 1],         1,         false
    union all select p.quartos[(a.n % 2) + 1],          2,         false
  ) as f
-- Idempotente: rodar duas vezes não duplica a galeria nem esbarra no
-- trigger de limite de 10 fotos.
 where not exists (
   select 1 from public.imoveis_fotos ff where ff.id_imovel = a.id
 );
