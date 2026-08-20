# REPLICACAO.md — Replicando a arquitetura para outros nichos

## 1. O que este documento é

O ImobFlow não é só um sistema de imobiliária. Por baixo do vocabulário imobiliário existe um template para **qualquer negócio que precise das cinco peças ao mesmo tempo**:

1. **Vitrine pública** com item cadastrável, filtrável e com página própria
2. **Painel interno** de gestão operando sobre a mesma base, sem publicação manual
3. **Agenda por profissional**, com disponibilidade individual
4. **CRM com funil**, alimentado por vários canais
5. **API autenticada por token**, consumível por um agente de IA

Se o negócio tem essas cinco peças, a arquitetura serve. Concessionária, clínica estética, agência de viagem, escola de curso — muda o substantivo, não a estrutura.

Este documento é sobre trocar de **nicho**. Para adaptar o ImobFlow a **outra imobiliária**, o documento é [NICHO.md](NICHO.md).

---

## 2. O esqueleto invariável

Isto não muda em replicação nenhuma. Copie como está.

### Tabelas padrão

| Tabela | Função |
|---|---|
| `usuarios` | Usuários do painel, espelhando `auth.users` por trigger |
| `api_tokens` | Tokens da API pública, com `nome` do consumidor e `ativo` para revogação |
| `configuracoes` | Dados do negócio, registro único, alimentando site e API ao mesmo tempo |
| `logs_sistema` | Trilha de auditoria, com `dados_anteriores` e `dados_novos` em `jsonb` |

Nenhuma dessas quatro tem qualquer coisa de imobiliário. Nem o nome muda.

### Tabela principal de leads: `crm_[nicho]`

`crm_imobiliaria` → `crm_concessionaria`, `crm_clinica`, `crm_escola`.

O que se mantém sempre:

- **`whatsapp` UNIQUE** — a chave natural do lead, o que permite o upsert do agente de IA. Guardado em E.164 sem o mais (`5511971351311`), e o formato tem que ser **um só em todos os caminhos de escrita**: o UNIQUE não enxerga que `11971351311` e `5511971351311` são a mesma pessoa, e cada caminho que normalizar diferente cria o seu próprio lead. Ver BANCO.md, "Por que `whatsapp` é UNIQUE"
- Blocos de coluna: base (`nome`, `email`, `tipo`, `status`, `origem`, `observacoes`), interesse específico do nicho, campos do agente de IA (`motivo_contato`, `resumo_conversa`, `ultima_mensagem`, `minutos_ultima_mensagem`, `data_agendamento`, `id_agendamento`, `follow_up_1`, `follow_up_2`) e campos do Chatwoot
- `tipo` com dois valores: o não convertido e o convertido (`lead` → `cliente`)

### Estrutura de agenda

Sempre a mesma cadeia de quatro tabelas:

```
[profissional] ──1:1──> agendas ──1:N──> agendas_horarios
                                              │
crm_[nicho] ──1:N──> agendamentos <───────────┘
```

- A agenda é criada **automaticamente** no cadastro do profissional, com janela padrão populada
- A janela de atendimento é **por profissional e por dia da semana**, nunca global
- Agendamentos em blocos de duração fixa, definida em `agendas.duracao_slot`
- Validação de conflito e de janela **no banco**, não na aplicação

### Rastreamento próprio

`visualizacoes_site`, sem alteração: `pagina`, `tipo_evento`, `session_id`, FK opcional para o item da vitrine e a cópia textual do código. Visualização deduplica por sessão; clique não.

### API autenticada por token

Edge Function que valida o token contra `api_tokens`, atualiza `ultimo_uso` e opera com `service_role`.

### Realtime

Na tabela principal de leads e na de agendamentos. É o que faz o Kanban se mover e a agenda se atualizar sem recarregar quando o agente de IA escreve.

Ambas em `replica identity full`, e isso **não é detalhe de configuração**: é o que faz o evento trazer a linha antiga inteira, sem a qual não dá para saber o que mudou. A guarda do job de relógio, logo abaixo, depende disso.

### Job de relógio

Um job de `pg_cron`, de 1 em 1 minuto, mantendo `minutos_ultima_mensagem` no valor real para o agente ler direto da tabela. Passa para qualquer nicho sem uma linha de mudança: a régua de follow-up é "há quanto tempo essa pessoa não fala comigo", e isso é igual em imobiliária, concessionária ou escola.

Três coisas viajam junto com ele, e nenhuma é opcional:

- **A extensão `pg_cron` precisa existir no banco novo.** É a única peça da instalação que falha sem dar erro: tudo sobe normalmente e só o número do agente fica congelado
- **O trigger de `updated_at` precisa da guarda `WHEN`**, senão o job carimba a tabela inteira a cada minuto e a coluna deixa de dizer quando o lead foi mexido
- **Toda tela que ouça a tabela de leads por Realtime precisa da saída antecipada.** O job vira um evento por lead por minuto, e uma tela que reaja a ele se recarrega sozinha sem nada ter acontecido

BANCO.md, seção 4.1, tem o desenho completo.

---

## 3. O que muda

Quatro coisas:

1. **A entidade central — o "item da vitrine".** É o que o cliente procura, filtra e agenda para conhecer. Em imobiliária é o imóvel; em concessionária é o veículo. Muda o nome da tabela e mudam as colunas específicas (um imóvel tem quartos e metragem; um veículo tem quilometragem, ano e câmbio). O que **não** muda é o esqueleto: código gerado automaticamente por sequence, `status` ativo/inativo, tabela de fotos com limite, contadores de visualização e clique.

2. **A entidade que conduz o atendimento.** Corretor, vendedor, profissional, consultor, coordenador. Muda o nome e alguns campos de cadastro (`creci` vira `matricula` ou `registro_profissional`). A estrutura de agenda pendurada nela é idêntica.

3. **O vocabulário de categorias.** `tipos_imovel` vira `tipos_veiculo`, `areas_tratamento`, `destinos`. Continua sendo **tabela editável pelo painel**, nunca `enum` — pelo mesmo motivo de sempre: quem conhece o vocabulário é o dono do negócio, não o desenvolvedor.

4. **As etapas do funil.** Os sete status de `crm_imobiliaria` descrevem o percurso de quem compra ou aluga imóvel. Em outro nicho eles mudam — e mudam em cinco lugares que precisam andar juntos. É o assunto da seção seguinte.

---

## 3b. Os sete status são do funil de imobiliária

Esta é uma das **primeiras coisas a adaptar**, e a mais fácil de subestimar: parece um `enum` de interface, mas atravessa o sistema inteiro, do trigger à API.

O percurso atual é:

```
novo → conversando → agendou → visitou → cancelou → follow_up_1 → follow_up_2
```

Ele descreve alguém que conversa, marca uma visita, visita e vira cliente. Em uma clínica, `visitou` é uma sessão realizada e existe a etapa de retorno; em uma escola, o percurso passa por aula experimental e matrícula; em uma concessionária, por test drive e proposta. **Copiar os sete sem pensar produz um Kanban com colunas que ninguém usa e sem a coluna que a equipe precisa** — e o pior é que o sistema funciona, então ninguém reclama até o funil não significar nada.

### Os cinco lugares que mudam juntos

| Onde | O quê | Se esquecer |
|---|---|---|
| `crm_[nicho]`, constraint `..._status_valido` | A lista de valores aceitos | O banco recusa o status novo com `check_violation`, e a interface não sabe por quê |
| `ETAPAS_FUNIL`, em `src/lib/leads.ts` | Chave, rótulo, frase de coluna vazia e classes de cor | A coluna some do Kanban; `etapaDoStatus` cai no primeiro item e todo mundo aparece como "Novo" |
| `--status-*`, em `src/index.css`, e a ponte no `@theme` | Uma cor por etapa | A classe não existe e o badge sai sem estilo — **só em produção**, porque o Tailwind gera as classes lendo o código como texto |
| Trigger 8 (`fn_sincronizar_status_lead`) e trigger 7 (`fn_lead_vira_cliente`) | Os literais `'agendou'`, `'visitou'`, `'cancelou'` e a promoção a cliente | O agendamento deixa de mover o lead no funil, em silêncio: nada falha, o lead só nunca sai de `novo` |
| API pública (Etapa 9) | Os valores que o agente de IA lê e escreve | O agente escreve um status que a constraint recusa, e a conversa quebra no meio |

Os filtros da tela de Leads e as colunas do Funil não são um sexto lugar: os dois leem `ETAPAS_FUNIL`. Foi construído assim justamente para que a lista de etapas tenha um dono só no frontend.

### Regra prática

Comece pelo trigger 8. Ele é o único ponto onde o status do lead muda **sem ninguém clicar** — é o agendamento que empurra o funil. Se o novo nicho não tem agendamento (uma loja que só vende pelo site, por exemplo), o trigger inteiro sai, e aí `agendou`, `visitou` e `cancelou` provavelmente saem com ele.

---

## 3c. O Dashboard: o que é universal e o que é de imobiliária

Os indicadores se dividem em dois grupos, e a diferença decide quanto trabalho a replicação dá.

### Universais — funcionam em qualquer nicho, sem tocar em nada

Estes medem o **mecanismo**, que é o mesmo em toda replicação: alguém chega pelo site, olha um item, clica no WhatsApp, vira lead, avança no funil e agenda algo.

| Indicador | Por que é universal |
|---|---|
| Tráfego do site (visitas, páginas mais acessadas) | `visualizacoes_site` não sabe o que é um imóvel — guarda caminho, evento e sessão |
| Ranking de itens mais vistos e mais clicados | A pergunta "o que atrai atenção" existe em concessionária, clínica e escola |
| **Taxa de conversão por item** (cliques ÷ visualizações) | O diagnóstico é idêntico: muito visto e pouco clicado é problema de preço ou de foto |
| Leads novos por dia e por período | O funil é o esqueleto invariável |
| Atendimentos do agente de IA por dia e por dia da semana | Depende de `inicio_atendimento`, que é da estrutura padrão de CRM |
| Agendamentos por dia e por dia da semana | A estrutura de agenda é a mesma |
| Leads por etapa do funil | Universal na forma; **os valores mudam** — ver seção 3b |

Na prática: as funções `fn_dashboard_serie_diaria`, `fn_dashboard_dia_semana`, `fn_dashboard_paginas` e `fn_dashboard_ranking_imoveis` funcionam em outro nicho apenas renomeando a tabela do item da vitrine.

### Específicos de imobiliária — precisam ser repensados

| Indicador | O que é específico | O que vira em outro nicho |
|---|---|---|
| **Divisão venda / locação** no cartão de imóveis ativos | `finalidade` só existe porque imóvel é vendido *ou* alugado, e às vezes os dois | Concessionária: venda/consórcio. Clínica: **não existe** — remova o recorte em vez de traduzir |
| **Divisão por tipo de imóvel** (rosca do estoque) | Lê `tipos_imovel` | Vira tipos de veículo, áreas de tratamento, destinos. A função continua igual, só muda a tabela |
| **Ativos sem foto** | Nasce da regra de que imóvel sem foto quase não é clicado | Vale para qualquer vitrine com foto. Não vale onde o item não é visual |
| Cores das etapas do funil na rosca | Ver seção 3b | Mudam junto com os status |

### A armadilha aqui

A tentação é traduzir `finalidade` para alguma coisa em todo nicho. **Em vários ele simplesmente não existe** — uma clínica não vende nem aluga um procedimento. Manter o cartão com um recorte que não significa nada é pior do que não ter o cartão: ele ocupa a posição mais visível da tela dizendo algo que ninguém consegue usar.

Quando o recorte não existir, o lugar certo é ocupado por outro que exista naquele negócio — capacidade ocupada numa clínica, turmas com vaga numa escola.

---

## 3d. Configurações: a aba de categorias é a que mais muda, e a tabela não muda nada

Das quatro abas de Configurações, três atravessam qualquer nicho sem uma linha diferente:

| Aba | O que muda ao replicar |
|---|---|
| Dados do negócio | Nada. Nome, logo, endereço, WhatsApp e fuso existem em todo negócio, e o campo mais consequente continua sendo o WhatsApp |
| **Tipos de imóvel** | **Só o conteúdo.** É a aba que mais muda entre nichos — e a estrutura não muda em nada |
| API | Nada. Um token por consumidor, revogável, com `ultimo_uso` |
| Logs | Só as frases em linguagem natural (`DESCRITORES`, em `src/lib/auditoria.ts`) |

**A observação que importa é a do meio.** "Casa, apartamento, terreno, chácara" e "hatch, sedan, SUV, picape" e "facial, corporal, capilar" não têm nada em comum como vocabulário — e produzem exatamente a mesma tabela:

```
id · nome (UNIQUE) · ativo · ordem
```

Com o mesmo comportamento em cima dela: FK com `ON DELETE RESTRICT` a partir do item da vitrine, desativação que preserva os registros existentes, `ordem` definida por arrastar valendo para os filtros do site.

Isso é sinal de que a modelagem está no nível certo. **A tentação a resistir é a de transformar categoria em `enum`** quando o nicho novo parece ter uma lista curta e estável — "carro só pode ser hatch, sedan ou SUV". Duas coisas acontecem, sempre nesta ordem: alguém precisa de "utilitário esportivo" seis meses depois, e a mudança que era um clique do dono vira migration, deploy e uma conversa com o desenvolvedor.

O sinal de que a estrutura deve ser preservada é justamente o oposto do que parece: **quanto mais óbvia a lista de categorias parece no dia da replicação, mais certeza de que ela vai mudar.**

A parte que de fato exige trabalho é a de **renomear**, e ela é ampla: `tipos_imovel` → `tipos_veiculo`, a FK, o rótulo da aba, o texto de ajuda ("o vocabulário da sua região" não faz sentido numa concessionária) e as frases de log. Nenhuma dessas é uma decisão de arquitetura — é tradução.

---

## 4. Tabela de tradução

| Nicho | Item da vitrine | Quem atende | Categorias | Agendamento |
|---|---|---|---|---|
| Imobiliária | Imóvel | Corretor | Tipos de imóvel | Visita ao imóvel |
| Concessionária | Veículo | Vendedor | Tipos de veículo | Test drive |
| Clínica estética | Procedimento | Profissional | Áreas de tratamento | Sessão |
| Agência de viagem | Pacote | Consultor | Destinos | Reunião de planejamento |
| Escola / curso | Turma | Coordenador | Áreas de ensino | Aula experimental |

### A mesma tradução no nível das tabelas

| ImobFlow | Concessionária | Clínica estética | Agência de viagem | Escola |
|---|---|---|---|---|
| `crm_imobiliaria` | `crm_concessionaria` | `crm_clinica` | `crm_agencia` | `crm_escola` |
| `imoveis` | `veiculos` | `procedimentos` | `pacotes` | `turmas` |
| `imoveis_fotos` | `veiculos_fotos` | `procedimentos_fotos` | `pacotes_fotos` | `turmas_fotos` |
| `tipos_imovel` | `tipos_veiculo` | `areas_tratamento` | `destinos` | `areas_ensino` |
| `corretores` | `vendedores` | `profissionais` | `consultores` | `coordenadores` |
| `codigo` = `IMV-0001` | `VEI-0001` | `PRO-0001` | `PAC-0001` | `TUR-0001` |

### E no nível das colunas do item

| ImobFlow | Concessionária | Clínica estética |
|---|---|---|
| `finalidade` (venda/locacao/ambos) | `finalidade` (venda/consorcio) | *não se aplica — remover, junto com a constraint* |
| `valor_venda` / `valor_aluguel` | `valor_venda` / `valor_parcela` | `valor_sessao` / `valor_pacote` |
| `quartos`, `suites`, `banheiros`, `vagas` | `ano`, `quilometragem`, `portas` | `duracao_minutos`, `sessoes_recomendadas` |
| `area_total`, `area_util` | `motor`, `cambio`, `combustivel` | `area_corporal` |
| `bairro`, `cidade`, `estado` | `cidade`, `estado` | `unidade` |
| `mobiliado`, `aceita_pet` | `blindado`, `unico_dono` | `requer_avaliacao` |
| `caracteristicas` (jsonb) | `caracteristicas` (jsonb) | `caracteristicas` (jsonb) |

O `jsonb` de `caracteristicas` é o amortecedor: tudo que é diferencial listável e não precisa de filtro estruturado cabe nele, sem coluna nova.

---

## 5. Passo a passo da replicação

1. **Renomear a tabela principal de leads** para `crm_[nicho]`. Ajustar os campos de interesse específico (`codigo_imovel_interesse` → `codigo_veiculo_interesse`, `finalidade_interesse` → o equivalente, `faixa_valor_min`/`max` costuma permanecer).

2. **Adaptar a tabela do item da vitrine.** Renomear e trocar as colunas específicas conforme a tabela acima. **Preservar sempre:** `codigo` UNIQUE gerado por sequence, `status` ativo/inativo, `id_[categoria]` com `ON DELETE RESTRICT`, os dois contadores e o `caracteristicas` em `jsonb`.

3. **Renomear a tabela de fotos** e manter o trio: FK com `CASCADE`, trigger de limite e índice único parcial da capa. Reavaliar o limite de 10 — veículo costuma pedir mais fotos que imóvel.

4. **Renomear a tabela de profissionais** e ajustar os campos de cadastro. Manter `cor` e `ativo`. Manter a agenda pendurada exatamente como está.

5. **Ajustar os valores de status do funil.** Em concessionária, `visitou` vira `test_drive_realizado`; em escola, `aula_experimental_feita`. São **cinco lugares que precisam mudar juntos** — constraint, `ETAPAS_FUNIL`, cores do `index.css`, triggers 7 e 8, e a API. Ver a seção 3b, que lista o que acontece quando cada um é esquecido.

6. **Ajustar o seed de categorias** para o vocabulário do nicho.

7. **Adaptar os filtros do site público** às colunas novas, **e os índices junto**. Índice em `quartos` não serve para nada num site de veículos; o que precisa de índice ali é `ano` e `quilometragem`.

8. **Renomear os endpoints da API** e o prefixo do código (`IMV-` → `VEI-`).

9. **Revisar os indicadores do Dashboard** — os universais funcionam renomeando a tabela do item; a divisão venda/locação e a rosca por tipo precisam ser repensadas. Ver seção 3c.

10. **Traduzir a tela de Configurações.** Três das quatro abas passam sem mudança estrutural; a de categorias muda só de conteúdo e de rótulo. O que precisa de atenção é a lista `DESCRITORES` em `src/lib/auditoria.ts`, que transforma cada ação em frase — "Excluiu o imóvel IMV-0042" vira "Excluiu o veículo VEI-0042". Ação sem frase cadastrada não some da tela: aparece com o nome legível da chave, que é como se descobre que faltou traduzir uma. Ver seção 3d.

11. **Traduzir a API.** Renomear os recursos e reescrever os filtros de busca — só isso. A disponibilidade, o formato de resposta, a autenticação e o limite de requisições passam intactos. Atualize `src/lib/endpointsApi.ts` junto com a Edge Function: é dele que sai a documentação exibida no painel, e documentação que envelhece em silêncio é pior do que documentação ausente. Ver seção 6.

12. **Publicar a Edge Function no projeto Supabase do nicho novo**, com `npx supabase functions deploy api --project-ref <ref>`. O passo parece burocrático e é dos que mais atrasam uma replicação: traduzir a API muda o código no disco, e código no disco não atende ninguém. Como o painel e a vitrine falam direto com o banco, os dois sobem inteiros sem a função, e o sintoma aparece só no primeiro teste do agente, em forma de `NOT_FOUND` — que se parece com erro de fluxo e não é. Confirme com uma chamada sem token: a resposta certa é a recusa de autenticação da própria API, não a do gateway do Supabase.

13. **Traduzir os textos fixos do frontend**, que são os únicos lugares fora da API onde o nicho aparece escrito à mão. São dois: `src/componentes/publico/textos.ts`, com hero, "como funciona", perguntas frequentes e chamada final; e a constante `AREAS`, no topo de `src/paginas/Login.tsx`, que monta os quatro cartões da coluna visual do login. Em concessionária, "Carteira de imóveis" vira "Estoque de veículos" e "Do primeiro contato à chave na mão" precisa de outra imagem. É a primeira tela que o cliente novo vê, e o texto errado ali é o tipo de coisa que ninguém revisa depois, porque quem já usa o sistema não olha mais o login.

14. **Reexecutar os testes de trigger** antes de considerar a replicação pronta. Cada regra tem um teste correspondente na Etapa 1 — conflito de horário, janela de atendimento, limite de fotos, sincronização de funil, deduplicação de contador.

15. **Conferir que o job de relógio subiu**, com `select jobname, active from cron.job`. Este passo é separado dos testes de trigger de propósito: trigger que não funciona derruba a escrita e aparece na hora, e job que não subiu não derruba nada. O sintoma é a régua de follow-up do agente lendo um número parado, semanas depois, numa conversa que ninguém no painel está lendo.

---

## 6. O que reescrever na API

A **estrutura dos endpoints não muda**, porque o que o agente de IA faz é o mesmo em qualquer nicho: descobrir o item, encontrar quem atende e operar a agenda. Estes são os endpoints que existem de fato (ver `src/lib/endpointsApi.ts`, que é a fonte da documentação exibida no painel):

| Endpoint | Função | O que muda no nicho novo |
|---|---|---|
| `POST /[itens]/buscar` | **Endpoint único do item.** Por código (`codigos` no corpo) ou por características | **Os filtros.** É a maior reescrita do conjunto. O prefixo do código vem de `normalizarCodigo`, que já o lê do que chegou |
| `GET /[itens]/ativos` · `/inativos` | Listagem por status | Só o nome do recurso |
| `POST /agenda/disponibilidade` | Horários livres, consolidados | **Nada** |
| `POST /agenda/agendar` | Cria o agendamento | Nada, além do campo de código do item |
| `POST /agenda/reagendar` · `/cancelar` | Move e cancela, por id | **Nada** |
| `GET /agenda/visitas` | Lista com o id de cada compromisso | Só o rótulo em `mensagem` |
| `GET /corretores` | Quem atende, com o id de cada um e o da agenda dele | **O nome do papel.** Vira `/consultores`, `/mecanicos`, `/professores` |
| `GET /leads/:whatsapp` | Lead e histórico. Somente leitura | Só os campos de interesse do nicho |
| `GET /[negocio]` | Dados do negócio, em frase montada | Nada |

O que muda, então, é: **os nomes dos recursos** e **os filtros de busca específicos do nicho**. A busca do ImobFlow aceita finalidade, tipo, cidade, bairro, faixa de preço e quartos; a de uma concessionária aceita marca, modelo, ano, faixa de quilometragem e câmbio.

**Um endpoint por recurso, e não um por forma de perguntar.** O ImobFlow teve três rotas de imóvel e as fundiu numa: código e características eram a mesma pergunta do cliente, e escolher entre elas era decisão que o agente podia errar em silêncio, produzindo uma resposta pior em vez de um erro. Vale igual em qualquer nicho: o agente manda o que tem, a API decide.

### A lógica de disponibilidade permanece idêntica

Vale isolar isso, porque é a parte mais cara de escrever e a que **não precisa ser escrita de novo**. O cálculo de `supabase/functions/_compartilhado/disponibilidade.ts` não contém uma linha de imobiliária:

> corretores ativos → janela de cada um no dia da semana → blocos de duração fixa → remover os ocupados → remover o que está perto demais de agora → consolidar em "livre se pelo menos um estiver livre".

Troque "corretor" por dentista, vendedor ou instrutor e o algoritmo é o mesmo. Nem o passo de consolidação muda: em todos esses negócios, quem atende é intercambiável do ponto de vista do cliente, e perguntar "com qual profissional?" na conversa é uma pergunta que ele não tem como responder.

O único parâmetro é a **duração do bloco**, e ela já é constante de um lugar só. Trinta minutos servem para visita a imóvel e para test drive; uma sessão de estética pede sessenta ou noventa. É uma linha.

### O que permanece porque não é do nicho

- A validação do token, o limite de requisições e o registro na trilha
- O formato da resposta: `sucesso`, `mensagem` conversacional e `erro` como código curto
- O payload mínimo nos endpoints de agenda, e as alternativas escritas **dentro** da mensagem
- A divisão entre o que passa pela API e o que o agente escreve direto na tabela
- E, principalmente: **agendar pela API dispara as mesmas validações de conflito e janela do painel.** O agente de IA não tem caminho privilegiado que pule as regras — os triggers valem para toda escrita, venha de onde vier

### O que exige atenção ao traduzir

**As frases.** `mensagem` é lida por uma pessoa no WhatsApp, e ela fala do nicho: "Visita confirmada" vira "Test drive confirmado", "Não encontrei o imóvel" vira "Não encontrei esse veículo". São textos, não lógica — mas são o que o cliente lê, e um deles esquecido em português de imobiliária numa clínica é constrangedor de um jeito que nenhum log revela.

**Os códigos de `erro`, não.** `horario_ocupado`, `fora_da_janela` e `data_no_passado` descrevem situações, não imóveis. Traduzi-los quebraria o switch do N8N sem ganhar nada.

**Os apelidos da busca, sim.** `APELIDOS_TIPO`, em `supabase/functions/api/imoveis.ts`, traduz o que o agente escreve para o nome do tipo cadastrado: `apto` vira apartamento, `kit` vira kitnet, `sala` vira comercial. Isso é vocabulário de imobiliária. Numa concessionária são `hatch`, `SUV`, `picape`, `zero km`; numa clínica, os nomes curtos dos procedimentos. A mecânica de normalizar sem acento, em `_compartilhado/texto.ts`, essa passa intacta: ela não sabe de que nicho está tratando.

Vale entender por que a lista existe, para não crescer errado: ela cobre só o que **não é pedaço** do nome cadastrado. "apartamentos" no plural e "apto" precisam estar ali; "apartamento padrão" não, porque a comparação por pedaço já resolve. E ela nunca substitui a lista real de tipos, que o dono edita no painel.

**A rota da página pública, sim.** `urlDoImovel`, em `supabase/functions/_compartilhado/configuracoes.ts`, monta `<url_site>/imovel/<codigo>` para devolver o campo `url` de cada ficha. O `/imovel/` ali é o caminho da vitrine e acompanha o nicho: vira `/veiculo/` na concessionária e `/procedimento/` na clínica, junto com a rota correspondente em `App.tsx`. É o mesmo par que o prefixo do código, e falha do mesmo jeito silencioso: o endereço continua sendo montado, o agente continua mandando, e quem clica recebe a página de não encontrado.

A regra de **não montar o link no lado do agente** é que não muda de nicho. O modelo precisa receber a URL pronta em `url`, porque endereço inventado por um modelo é indistinguível de endereço certo até alguém tocar nele.

---

## 7. Armadilhas comuns

**Esquecer de ajustar o trigger que sincroniza status entre agendamento e lead.** É o erro mais frequente, porque o trigger continua funcionando — só que escrevendo o status errado. Se o funil do nicho novo usa `test_drive_realizado` no lugar de `visitou`, mas a função de trigger continua com `'visitou'` no código, o `UPDATE` viola a constraint CHECK e todo agendamento passa a falhar. Ou, pior, se o CHECK também foi esquecido, o lead vai para um status que nenhuma coluna do Kanban exibe e simplesmente some da tela.

**Esquecer de ajustar a constraint de valores obrigatórios por finalidade.** No ImobFlow, `imoveis_valor_por_finalidade` exige `valor_venda` quando a finalidade é `venda`. Numa clínica estética, onde não existe "finalidade", a constraint copiada sem revisão bloqueia todo cadastro com uma mensagem que não faz sentido nenhum para o usuário. Ou é adaptada à regra real do nicho, ou é removida — nunca deixada como está.

**Manter filtros do nicho antigo no site público.** Filtro de "quartos" num site de veículos é o sintoma óbvio, e é o que se percebe rápido. O que passa despercebido é o inverso: o filtro novo criado sem o índice correspondente, ou o índice antigo deixado para trás. Um site de veículos filtrando por `ano` sem índice em `ano` funciona perfeitamente com trezentos registros e trava com trinta mil.

**Mudar o status no banco e esquecer a cor no `index.css`.** As classes de cor das etapas ficam escritas por extenso em `ETAPAS_FUNIL` porque o Tailwind gera CSS lendo o código como texto — `bg-status-${chave}` nunca seria encontrado. A consequência disso na replicação: uma etapa nova cuja cor não foi declarada em `src/index.css` não quebra nada no desenvolvimento, porque o badge simplesmente herda o fundo do que estiver atrás. O buraco só aparece na tela do cliente.

**Duas armadilhas menores, mas que custam caro:**

- **Copiar o seed sem revisar.** `tipos_imovel` com casa e apartamento numa clínica estética é constrangedor em demonstração e vira dado sujo em produção.
- **Manter o prefixo `IMV-` no código.** Funciona tecnicamente e passa em todo teste — até o primeiro cliente perguntar por que o código do carro dele começa com IMV.
