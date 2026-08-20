# BANCO.md — Banco de dados do ImobFlow

Documentação completa do schema: tabelas, campos, relacionamentos, triggers, políticas de RLS e a justificativa de cada decisão.

Este arquivo é **atualizado** a cada etapa que altera o banco, nunca recriado.

- Banco: Postgres 17 no Supabase
- Timezone do banco: `America/Sao_Paulo` (definido via `ALTER DATABASE ... SET timezone`)
- Migrations versionadas em [supabase/migrations/](supabase/migrations/)

---

## 1. Visão geral do schema

São 13 tabelas, organizadas em cinco domínios, mais uma view.

### Padrão do sistema

`usuarios` · `api_tokens` · `configuracoes` · `logs_sistema`

Não são específicas de imobiliária. Existem em qualquer replicação da arquitetura. `usuarios` espelha `auth.users`; `api_tokens` autentica a API pública; `configuracoes` é registro único e alimenta site e API ao mesmo tempo; `logs_sistema` é a trilha de auditoria.

### Leads e funil

`crm_imobiliaria`

Tabela principal. Não tem chave estrangeira para nenhuma outra — é ela que é referenciada. `agendamentos.id_lead` aponta para cá.

### Imóveis e vitrine

`tipos_imovel` → `imoveis` → `imoveis_fotos`

`imoveis.id_tipo_imovel` referencia `tipos_imovel` com **RESTRICT**. `imoveis_fotos.id_imovel` referencia `imoveis` com **CASCADE**: apagou o imóvel, as fotos vão junto.

### Agenda e atendimento

`corretores` → `agendas` → `agendas_horarios`
`agendamentos` (liga `crm_imobiliaria` + `imoveis` + `corretores`)

Cadeia 1:1:N. Um corretor tem exatamente uma agenda (UNIQUE em `agendas.id_corretor`), criada por trigger. Uma agenda tem N janelas de atendimento, uma por dia da semana ativo.

`agendamentos` é o ponto de encontro dos três domínios: um lead, um imóvel e um corretor.

### Rastreamento

`visualizacoes_site`

Referencia `imoveis` com SET NULL e alimenta por trigger os contadores `total_visualizacoes` e `total_cliques_whatsapp` da tabela `imoveis`.

### A única view

`info_imob_agente`

Lê `configuracoes` e devolve os dados da imobiliária em uma coluna de texto, para o agente de IA repassar ao cliente sem compor nada. Detalhe na seção 2.14, motivo na seção 3.

### O único job

`minutos_ultima_mensagem`, em `pg_cron`, de 1 em 1 minuto.

Mantém `crm_imobiliaria.minutos_ultima_mensagem` no valor real, para o agente de IA ler direto da tabela. Detalhe na seção 4.1. **Banco novo precisa da extensão `pg_cron`** — a migration `…024` a cria, e a seção 8 traz como conferir que ficou de pé, porque a falta dela não gera erro nenhum.

### Mapa de relacionamentos

```
auth.users ──1:1──> usuarios ──0:N──> logs_sistema

tipos_imovel ──1:N──> imoveis ──1:N──> imoveis_fotos
                         │
                         └──0:N──> visualizacoes_site

corretores ──1:1──> agendas ──1:N──> agendas_horarios
     │
     └──1:N──┐
crm_imobiliaria ──1:N──> agendamentos <──0:N── imoveis
```

---

## 2. Tabelas em detalhe

Convenções válidas para todas as tabelas:

- PK sempre `uuid` com `gen_random_uuid()`, exceto `usuarios`, que herda o `id` de `auth.users`
- `created_at` e `updated_at` são `timestamptz not null default now()`
- `updated_at` é mantido por trigger `BEFORE UPDATE`
- RLS ativo em todas

---

### 2.1 `usuarios`

**Propósito:** usuários do painel interno. Não existe tela de cadastro público — usuários são criados pelo desenvolvedor no Supabase Auth.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK. FK → `auth.users.id` **ON DELETE CASCADE** |
| `nome` | text | sim | |
| `email` | text | sim | UNIQUE |
| `created_at` | timestamptz | sim | `now()` |
| `updated_at` | timestamptz | sim | `now()`, mantido por trigger |

**Índices:** PK em `id`; único em `email`.

---

### 2.2 `api_tokens`

**Propósito:** tokens da API pública consumida pelo agente de IA e por sistemas externos. Um registro por consumidor, o que permite revogar um integrador sem derrubar os outros.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `nome` | text | sim | Identifica o consumidor (ex: `agente_ia_whatsapp`) |
| `token` | text | sim | UNIQUE |
| `ativo` | boolean | sim | Padrão `true`. Revogação é `false`, não exclusão |
| `ultimo_uso` | timestamptz | não | Atualizado pela Edge Function a cada chamada válida |
| `created_at` | timestamptz | sim | |
| `updated_at` | timestamptz | sim | |

**Índices:** PK; único em `token`; `idx_api_tokens_token` parcial em `token WHERE ativo` — a validação da API só busca token ativo, então o índice parcial é menor e mais rápido.

**Sem chaves estrangeiras.**

---

### 2.3 `configuracoes`

**Propósito:** dados da imobiliária. Registro único. Alimenta cabeçalho e rodapé do site público, o botão de WhatsApp e as respostas da API ao mesmo tempo.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `nome_negocio` | text | sim | |
| `logo_url` | text | não | Aponta para o bucket `logos` |
| `endereco`, `cep`, `cidade`, `estado` | text | não | |
| `telefone` | text | não | |
| `whatsapp` | text | não | Número que recebe os cliques do site |
| `email`, `site`, `instagram`, `link_google_maps` | text | não | |
| `url_site` | text | não | Endereço onde a **vitrine** está publicada. A API monta a URL de cada imóvel a partir daqui. Ver abaixo |
| `foto_hero_url` | text | não | Foto da primeira dobra do site. Vazia = usa a capa do imóvel em destaque (Etapa 6) |
| `fuso_horario` | text | sim | Padrão `America/Sao_Paulo` |
| `horario_funcionamento` | jsonb | não | Atendimento ao público por dia da semana. Declarativo: **não** valida agendamento. Ver abaixo |
| `created_at` / `updated_at` | timestamptz | sim | |

**`horario_funcionamento` não é a janela de visitas** (migration `…023`). Quem decide se um agendamento cabe continua sendo `agendas_horarios`, a janela de cada corretor, validada pelos triggers 4 e 5. Esta coluna alimenta a frase que o agente fala no WhatsApp e o bloco "Atendimento" da seção Sobre da home, e não recusa nada.

Os dois existem porque são diferentes de verdade: a imobiliária abre das 9h às 18h e pode fazer visitas só das 10h às 16h. O risco é declarar **mais largo** do que os corretores cobrem, porque aí o agente promete um horário que o banco nega. A aba de Configurações compara os dois e avisa antes de salvar, sem bloquear.

Formato: array de objetos, um por dia, na convenção `0 = domingo` de `agendas_horarios`. Um intervalo por dia, sem pausa de almoço.

```json
[{"dia": 1, "aberto": true, "abre": "09:00", "fecha": "18:00"},
 {"dia": 0, "aberto": false}]
```

`null` significa não informado, e **nenhum dia aberto grava `null`**: os dois diriam a mesma coisa a quem lê, e imobiliária fechada a semana inteira não existe. O CHECK `configuracoes_horario_funcionamento_array` garante só a forma de array, para um toque manual pelo SQL editor não transformar a view num erro de execução.

**`url_site` não é `site`.** `site` é o site institucional, se a imobiliária tiver outro além da vitrine. Ele **não é exibido na vitrine**: sai apenas na frase da view `info_imob_agente`, que o agente de IA lê e repassa ao cliente. `url_site` é o endereço da própria vitrine, e serve a um consumidor só: a API, que devolve em cada ficha de imóvel o campo `url` apontando para `<url_site>/imovel/IMV-0001`. É assim que o agente de IA manda ao cliente o link das fotos.

A coluna existe (migration `…021`) porque **a Edge Function não tem como descobrir esse endereço sozinha**. O painel monta o link com `window.location.origin`, que é o navegador; na função, a requisição vem do N8N e o único domínio conhecido é o das Edge Functions, que não é o da vitrine. Ficou em `configuracoes` e não num secret da função pela mesma razão do `fuso_horario`: é dado de implantação, muda por cliente, e a aba de Configurações existe justamente para que uma instalação nova não exija linha de comando.

Vazia, o campo `url` sai `null` em todas as fichas e a mensagem da API não menciona link. Nada quebra, e é o estado correto antes de a vitrine ir ao ar.

**Índices:** PK; `uidx_configuracoes_registro_unico` — índice **único sobre a expressão constante `(true)`**. Como toda linha produz o mesmo valor, o segundo `INSERT` viola a unicidade. É a forma mais barata de garantir registro único sem coluna artificial de controle.

**Sem chaves estrangeiras.**

---

### 2.4 `logs_sistema`

**Propósito:** trilha de auditoria. É a única fonte de rastreabilidade de imóveis excluídos, já que a exclusão em `imoveis` é definitiva.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `id_usuario` | uuid | não | FK → `usuarios.id` **ON DELETE SET NULL** |
| `acao` | text | sim | Ex: `imovel_excluido` |
| `tabela` | text | não | |
| `id_registro` | text | não | `text` e não `uuid`: o registro referenciado pode não existir mais |
| `dados_anteriores` | jsonb | não | Snapshot antes da ação |
| `dados_novos` | jsonb | não | Snapshot depois da ação |
| `created_at` | timestamptz | sim | |

**Por que SET NULL em `id_usuario`:** desligar um funcionário não pode apagar o histórico do que ele fez. O log sobrevive ao usuário, apenas perde a autoria.

**Índices:** `idx_logs_sistema_created_at` (DESC), `idx_logs_sistema_usuario`, `idx_logs_sistema_tabela` composto em (`tabela`, `id_registro`).

---

### 2.5 `crm_imobiliaria`

**Propósito:** tabela principal de leads. Alimenta a página de Leads e o Kanban do CRM.

**Colunas base**

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `whatsapp` | text | sim | **UNIQUE.** Único campo obrigatório na criação. Guardado em **E.164 sem o mais**: `5511971351311` |
| `nome`, `email` | text | não | |
| `tipo` | text | sim | Padrão `lead`. CHECK: `lead`, `cliente` |
| `status` | text | sim | Padrão `novo`. CHECK: `novo`, `conversando`, `agendou`, `cancelou`, `visitou`, `follow_up_1`, `follow_up_2` |
| `origem` | text | não | `site`, `whatsapp`, `indicacao` |
| `observacoes` | text | não | |

**Colunas do nicho**

| Coluna | Tipo | Observação |
|---|---|---|
| `codigo_imovel_interesse` | text | Código do imóvel que originou o contato via link do site |
| `finalidade_interesse` | text | CHECK: `venda`, `locacao` |
| `tipo_imovel_interesse` | text | |
| `faixa_valor_min` / `faixa_valor_max` | numeric | |

**Colunas do agente de IA**

| Coluna | Tipo | Observação |
|---|---|---|
| `motivo_contato` | text | |
| `resumo_conversa` | text | |
| `inicio_atendimento` | timestamptz | |
| `ultima_mensagem` | timestamptz | |
| `minutos_ultima_mensagem` | integer | Gravado pelo trigger 9 e envelhecido de minuto em minuto pelo job `minutos_ultima_mensagem` |
| `data_agendamento` | timestamptz | Mantido pelo trigger 8 |
| `id_agendamento` | text | Mantido pelo trigger 8 |
| `follow_up_1` / `follow_up_2` | timestamptz | |

**Colunas do Chatwoot**

`id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot`, `inbox_id_chatwoot` — todas `text`, todas opcionais. Existem desde a Etapa 1 para que a integração da Etapa 9 não exija migração.

**Sem chaves estrangeiras.** É a tabela referenciada, não a que referencia.

**Índices:** PK; único em `whatsapp` (a constraint UNIQUE já cria o índice — não há índice duplicado); `idx_crm_status`; `idx_crm_codigo_imovel_interesse`; `idx_crm_created_at` (DESC).

---

### 2.6 `tipos_imovel`

**Propósito:** categorias de imóvel, editáveis pelo painel.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `nome` | text | sim | UNIQUE |
| `ativo` | boolean | sim | Padrão `true` |
| `ordem` | integer | sim | Padrão `0`. Controla a ordem nos filtros do site |
| `created_at` / `updated_at` | timestamptz | sim | |

**Índices:** PK; único em `nome`; `idx_tipos_imovel_ordem` parcial em (`ordem`, `nome`) `WHERE ativo` — os filtros do site só listam tipos ativos.

**Seed:** Casa, Apartamento, Terreno, Chácara, Sítio, Comercial, Galpão, Cobertura, Kitnet, Fazenda, Sobrado.

---

### 2.7 `imoveis`

**Propósito:** cadastro dos imóveis. Alimenta o site público e a API.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `codigo` | text | sim | UNIQUE. Gerado pelo trigger 2, formato `IMV-XXXX` |
| `titulo` | text | sim | |
| `descricao` | text | não | |
| `id_tipo_imovel` | uuid | sim | FK → `tipos_imovel.id` **ON DELETE RESTRICT** |
| `finalidade` | text | sim | CHECK: `venda`, `locacao`, `ambos` |
| `status` | text | sim | Padrão `ativo`. CHECK: `ativo`, `inativo` |
| `cep`, `endereco`, `numero`, `complemento` | text | não | |
| `bairro`, `cidade`, `estado` | text | **sim** | Base dos filtros do site |
| `valor_venda`, `valor_aluguel` | numeric | condicional | Ver constraint abaixo |
| `valor_condominio`, `valor_iptu` | numeric | não | |
| `area_total`, `area_util` | numeric | não | |
| `quartos`, `suites`, `banheiros`, `vagas` | integer | sim | Padrão `0` |
| `mobiliado`, `aceita_pet` | boolean | sim | Padrão `false` |
| `caracteristicas` | jsonb | não | Lista livre de diferenciais |
| `proprietario_nome`, `proprietario_contato` | text | não | Nunca expostos ao site público |
| `total_visualizacoes` | integer | sim | Padrão `0`, mantido pelo trigger 10 |
| `total_cliques_whatsapp` | integer | sim | Padrão `0`, mantido pelo trigger 10 |
| `created_at` / `updated_at` | timestamptz | sim | |

**Constraint `imoveis_valor_por_finalidade`:**

```sql
(finalidade <> 'venda'   or valor_venda   is not null)
and (finalidade <> 'locacao' or valor_aluguel is not null)
and (finalidade <> 'ambos'   or (valor_venda is not null and valor_aluguel is not null))
```

Um imóvel à venda sem preço de venda não é um cadastro incompleto: é um card quebrado na vitrine e um filtro de faixa de preço que nunca o encontra.

**Índices:** PK; único em `codigo`; `status`; `finalidade`; `cidade`; `bairro`; `id_tipo_imovel`; `valor_venda`; `valor_aluguel`; `quartos`. Todos correspondem a um filtro real do site público ou da busca por características da API.

---

### 2.8 `imoveis_fotos`

**Propósito:** galeria de fotos do imóvel.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `id_imovel` | uuid | sim | FK → `imoveis.id` **ON DELETE CASCADE** |
| `url` | text | sim | URL pública do bucket `imoveis` |
| `ordem` | integer | sim | Padrão `0` |
| `capa` | boolean | sim | Padrão `false` |
| `created_at` | timestamptz | sim | |

**Índices:** PK; `idx_imoveis_fotos_imovel` composto em (`id_imovel`, `ordem`); `uidx_imoveis_fotos_capa_unica` — **índice único parcial** em `(id_imovel) WHERE capa`, garantindo no máximo uma capa por imóvel.

O limite de 10 fotos é imposto pelo trigger 6.

---

### 2.9 `corretores`

**Propósito:** cadastro dos corretores.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `nome`, `sobrenome` | text | sim | |
| `whatsapp`, `email`, `creci` | text | não | |
| `cor` | text | sim | Hexadecimal. CHECK: `^#([0-9a-f]{3}|[0-9a-f]{6})$` |
| `ativo` | boolean | sim | Padrão `true` |
| `created_at` / `updated_at` | timestamptz | sim | |

**Sem chaves estrangeiras.** Não há vínculo entre corretor e imóvel: qualquer corretor disponível conduz qualquer visita.

**Índices:** PK; `idx_corretores_ativo`.

---

### 2.10 `agendas`

**Propósito:** agenda individual do corretor. Criada automaticamente pelo trigger 3.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `id_corretor` | uuid | sim | **UNIQUE.** FK → `corretores.id` **ON DELETE CASCADE** |
| `duracao_slot` | integer | sim | Padrão `30`. CHECK > 0 |
| `created_at` / `updated_at` | timestamptz | sim | |

O UNIQUE em `id_corretor` transforma a relação em 1:1 no nível do banco. Não existe corretor com duas agendas.

---

### 2.11 `agendas_horarios`

**Propósito:** janela de atendimento por dia da semana.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `id_agenda` | uuid | sim | FK → `agendas.id` **ON DELETE CASCADE** |
| `dia_semana` | integer | sim | CHECK `between 0 and 6`. 0 = domingo, mesma convenção de `extract(dow)` |
| `hora_inicio` | time | sim | |
| `hora_fim` | time | sim | CHECK `hora_fim > hora_inicio` |
| `ativo` | boolean | sim | Padrão `true` |
| `created_at` | timestamptz | sim | |

Usar a mesma convenção de `extract(dow)` do Postgres elimina conversão de índice no trigger 5. Toda tradução de calendário é uma chance de erro silencioso de um dia.

**Índices:** PK; `idx_agendas_horarios_agenda` composto em (`id_agenda`, `dia_semana`) — exatamente o acesso do trigger 5.

---

### 2.12 `agendamentos`

**Propósito:** visitas aos imóveis, em blocos de 30 minutos.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `id_lead` | uuid | sim | FK → `crm_imobiliaria.id` **ON DELETE CASCADE** |
| `id_imovel` | uuid | não | FK → `imoveis.id` **ON DELETE SET NULL** |
| `id_corretor` | uuid | sim | FK → `corretores.id` **ON DELETE RESTRICT** |
| `codigo_imovel` | text | não | Cópia do código no momento do agendamento |
| `data_hora_inicio` | timestamptz | sim | |
| `data_hora_fim` | timestamptz | sim | CHECK `> data_hora_inicio` |
| `status` | text | sim | Padrão `agendada`. CHECK: `agendada`, `realizada`, `cancelada`, `reagendada` |
| `observacoes` | text | não | |
| `origem` | text | não | CHECK: `painel`, `agente_ia`, `api` |
| `created_at` / `updated_at` | timestamptz | sim | |

**Índices:** PK; `id_corretor`; `data_hora_inicio`; `status`; `id_lead`.

---

### 2.13 `visualizacoes_site`

**Propósito:** rastreamento próprio de tráfego do site público, sem depender de ferramenta externa.

| Coluna | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | uuid | sim | PK |
| `pagina` | text | sim | Caminho da página acessada |
| `id_imovel` | uuid | não | FK → `imoveis.id` **ON DELETE SET NULL** |
| `codigo_imovel` | text | não | Preserva a referência após exclusão do imóvel |
| `tipo_evento` | text | sim | CHECK: `visualizacao`, `clique_whatsapp` |
| `referrer`, `user_agent`, `session_id` | text | não | |
| `created_at` | timestamptz | sim | |

**Índices:** `created_at` (DESC); `id_imovel`; `tipo_evento`; `pagina`; e o composto `idx_visualizacoes_dedup` em (`session_id`, `id_imovel`, `tipo_evento`), que é exatamente a consulta do trigger 10.

---

### 2.14 `info_imob_agente` — a única view do schema

**Propósito:** entregar ao agente de IA os dados da imobiliária em **uma única coluna de texto**, pronta para ele repassar ao cliente no WhatsApp sem compor nada.

**Não é tabela e não guarda dado nenhum.** Lê `configuracoes` no instante da consulta. O motivo de ser view, e não espelho materializado, está na seção 3.

| Coluna | Tipo | Observação |
|---|---|---|
| `informacoes` | text | Bloco de texto, uma informação por linha |

**De onde vem cada linha:**

| Linha gerada | Origem em `configuracoes` |
|---|---|
| `<nome>.` | `nome_negocio` |
| `Endereço: …` | `endereco`, `cidade`, `estado`, `cep` |
| `Como chegar: …` | `link_google_maps` |
| `Atendimento: …` | `horario_funcionamento` |
| `Telefone: …` | `telefone` |
| `WhatsApp: …` | `whatsapp` |
| `E-mail: …` | `email` |
| `Site: …` | `site` |
| `Instagram: …` | `instagram` |

Saída com tudo preenchido:

```
Imobiliária Alvorada.
Endereço: Avenida Adolfo Pinheiro, 933, São Paulo, SP, CEP 04733-200.
Como chegar: https://maps.app.goo.gl/L3BpeCcPcTKA5x3P6
Atendimento: segunda a sexta das 9h às 18h; sábado das 9h às 13h; domingo fechado.
Telefone: (11) 3221-4400
WhatsApp: (11) 99715-1311
E-mail: contato@alvoradaimoveis.com
Site: https://alvoradaimoveis.com.br
Instagram: https://instagram.com/alvoradaimoveis
```

**Cinco regras de montagem, todas com consequência visível para o cliente:**

- **Campo vazio não vira linha.** Cada linha é montada inteira ou não é montada. É o que impede "Instagram: não informado", que é pior do que o silêncio porque o agente repassa isso como se fosse informação
- **Telefone e WhatsApp saem formatados**, por `fn_telefone_legivel`. Na coluna, `whatsapp` está em E.164 sem o mais (`5511997151311`); entregue cru, o cliente não reconhece aquilo como telefone
- **O CEP recebe o hífen.** Gravado como `04733200`, sai `04733-200`
- **Os três endereços da web saem como link absoluto**, por `fn_url_absoluta`. É o ponto em que o texto deixa de ser informação e vira ação: no WhatsApp, `alvoradaimoveis.com.br` é texto morto e `https://alvoradaimoveis.com.br` é um toque. Vale para `site` e `link_google_maps`; a função prefixa `https://` quando falta e tira a barra final, e **preserva `http://` quando é o que está cadastrado**, porque forçar `https` num site sem certificado produz erro de segurança em vez de página
- **O Instagram sai como URL, não como `@usuario`.** Pela mesma razão: `@alvorada` obriga o cliente a copiar o nome e procurar dentro do aplicativo. O handle é extraído primeiro, então handle, `@handle` e URL inteira convergem para a mesma saída, e concatenar sem extrair produziria `instagram.com/https://instagram.com/alvorada`
- **As linhas de link não terminam em ponto.** Ponto colado numa URL é engolido pelo endereço em vários aplicativos de mensagem, e o link chega quebrado justo onde ele mais importa. Mesma regra que a API já segue nas fichas de imóvel

**Uma informação por linha, e não frase corrida.** Três linhas terminam em endereço da web; numa frase corrida os links se encostam nas vírgulas e nenhum fica clicável inteiro.

**Registro único:** `configuracoes` tem índice único sobre expressão constante, então a view devolve **uma linha**. Se a tabela estiver vazia, devolve **zero linhas** — o consumidor precisa tratar isso, é o estado de instalação nova.

**A linha de atendimento agrupa dias**, por `fn_horario_funcionamento_legivel`. Sete linhas numa mensagem de WhatsApp ninguém lê até o fim, e é justamente quem está decidindo se vai até lá que precisa dessa informação. Três decisões dentro dela:

- **Só os dias abertos formam grupo; os fechados entram uma vez, no fim.** Tratados como grupo de primeira classe eles se intercalam e a frase abre pelo que a imobiliária não faz: quem atende só quarta lia "segunda e terça fechados; quarta das 14h às 18h; quinta a domingo fechados", três orações para dizer uma
- **O agrupamento é sobre a lista já filtrada**, e é o que permite juntar dias não vizinhos: segunda, quarta e sexta viram uma oração só. A contiguidade na semana é conferida à parte, para decidir entre "segunda a sexta" e "segunda, quarta e sexta" — um intervalo com buraco no meio afirmaria que a imobiliária abre na terça
- **A semana começa na segunda**, não no domingo da convenção de `dia_semana`, porque é assim que se lê horário comercial

Devolve `null` quando nada foi informado **e também quando um dia está marcado como aberto sem horário**: ali não dá para afirmar o horário nem chamá-lo de fechado, e a frase inteira some em vez de dizer o que o cadastro não diz.

**Dependências:** quatro funções `immutable`, criadas nas migrations `…022` e `…023`, todas para a regra não ficar escrita duas ou três vezes dentro da própria view:

- `fn_telefone_legivel(text)` — usada em `telefone` e em `whatsapp`
- `fn_url_absoluta(text)` — usada em `site` e em `link_google_maps`
- `fn_hora_legivel(text)` — `09:00` vira `9h`, `13:30` vira `13h30`
- `fn_horario_funcionamento_legivel(jsonb)` — a semana inteira em uma frase

**Privilégios:** `security_invoker = true`, obrigatório — sem ele a view roda com os privilégios do dono e passa por cima do RLS de `configuracoes`, que é o alerta `security_definer_view` do linter do Supabase. `anon` é revogado por disciplina, não por sigilo: os mesmos dados já saem no rodapé do site público. O que não faz sentido é entregar o bloco pronto do agente a quem não é o agente.

---

## 3. O porquê de cada decisão

### Por que a exclusão de imóvel é definitiva e a desativação é reversível

São dois problemas diferentes que a exclusão lógica resolve mal ao mesmo tempo. Imóvel vendido ou que saiu da carteira deve sumir de verdade: com exclusão lógica, toda consulta do painel, do site e da API passa a exigir `where excluido = false`, e o dia em que alguém esquecer o filtro, um imóvel que não existe mais reaparece na vitrine. Imóvel que está temporariamente fora do ar é outra coisa — para isso existe `status = inativo`, que preserva fotos, contadores e histórico e volta com um clique. A rastreabilidade do que foi excluído fica em `logs_sistema`, que é o lugar certo para histórico, e não na tabela operacional.

### Por que `whatsapp` é UNIQUE em `crm_imobiliaria`

Porque é a chave natural do lead: o mesmo número é sempre a mesma pessoa. Com UNIQUE, o agente de IA opera por `INSERT ... ON CONFLICT (whatsapp) DO UPDATE`, uma única operação atômica. Sem UNIQUE, o agente é obrigado a "buscar, se não achar criar" — duas operações com uma janela de corrida entre elas, e duas mensagens simultâneas do mesmo contato criam dois leads. É exatamente daí que nascem os leads duplicados. O banco resolve isso de graça.

**O UNIQUE só protege se o formato for um só, e essa parte o banco não resolve.** `11971351311` e `5511971351311` são o mesmo telefone e strings diferentes, então entram como dois leads sem que nada reclame. Foi o que aconteceu até a migration `…020`: a Edge Function removia o `55` antes de gravar, enquanto o agente, escrevendo direto pelo N8N, gravava completo. Cada caminho criava o seu.

O formato definido é **E.164 sem o sinal de mais**: código do país seguido do número nacional, só dígitos. `5511971351311` no Brasil, `351912345678` em Portugal. É o que o `wa.me` aceita sem conversão.

Quem garante isso é código, em um lugar de cada lado da fronteira: `supabase/functions/_compartilhado/telefone.ts` nas Edge Functions e `src/lib/telefone.ts` no painel. **Não existe CHECK na coluna**, e é decisão consciente: ele barraria a escrita torta do N8N, que roda com service role e ignora o RLS, mas também derrubaria o cadastro de lead do agente no primeiro número com máscara, em produção. O comando fica comentado no fim da migration `…020`, para o dia em que o fluxo do agente for auditado.

### Como a interface trata a duplicidade de `whatsapp`

A constraint é a mesma para todo mundo, mas os dois caminhos que escrevem em `crm_imobiliaria` querem coisas diferentes dela, e a Etapa 5 tratou os dois de forma distinta de propósito.

**O agente de IA e o cadastro rápido dentro do modal de visita usam upsert.** `INSERT ... ON CONFLICT (whatsapp) DO UPDATE`. Nesses dois casos o lead é meio de caminho — o objetivo é responder a mensagem ou marcar a visita — e aproveitar o registro existente em silêncio é o comportamento certo.

**O cadastro manual da tela de Leads usa insert puro.** Aqui a intenção é outra: alguém está cadastrando uma pessoa. Um upsert sobrescreveria com os campos em branco do formulário novo um lead que talvez já tenha resumo de conversa, faixa de valor e histórico — perda de dado silenciosa, que é o pior tipo.

Então o cadastro manual precisa lidar com a colisão, e faz isso em duas camadas:

1. **Consulta prévia por `whatsapp`** antes do insert. Se o número já existe, a interface não mostra erro: informa que o contato já está cadastrado, diz o nome dele e oferece **abrir o cadastro existente**. É a resposta útil, porque quem está ali quer registrar aquela pessoa — e ela já está lá.
2. **Tratamento do código `23505`** (`unique_violation`) no `catch`. A consulta prévia não é garantia de nada: entre ela e o insert existe uma janela em que o agente de IA pode ter criado o mesmo número. Quando isso acontece, o erro do banco cai no mesmo caminho da camada 1 e o usuário vê a mesma tela.

A camada 1 existe pela experiência; **a camada 2 é a que garante a correção**. Sem ela, uma corrida de milissegundos viraria um erro cru na tela. Sem a camada 1, o caso comum — número repetido digitado por quem não sabia — seria tratado como falha em vez de como informação.

A mesma checagem vale na edição, com uma diferença: o próprio lead não conta como duplicidade, senão salvar sem mudar o número acusaria conflito consigo mesmo.

Verificado contra o banco: insert repetido devolve `23505` tanto em SQL direto quanto pelo PostgREST, e o upsert por `whatsapp` devolve o **mesmo id** do registro original, deixando uma linha só.

### Por que a janela de atendimento vive em `agendas_horarios` e não numa configuração global

Porque corretor não é um recurso homogêneo. Um atende de manhã, outro só à tarde, outro trabalha sábado. Uma configuração global de horário comercial força todo mundo para o mesmo molde e o ajuste vira exceção codificada na aplicação. Com a janela por corretor e por dia da semana, a disponibilidade real do time é dado, não código, e o dono ajusta pelo painel sem deploy.

**`configuracoes.horario_funcionamento` não contradiz isso**, e a distinção é a parte que precisa sobreviver: ele é o horário em que a **imobiliária atende o público**, e a janela é quando **cada corretor faz visita**. Nenhum agendamento passa pelo primeiro. Se um dia alguém for tentado a validar agendamento contra ele, a pergunta a fazer antes é a que originou esta seção: qual dos dois manda quando um corretor atende sábado e a imobiliária não abre? A resposta continua sendo o corretor, e é por isso que a validação continua onde está.

O que existe entre os dois é uma conferência de tela, não uma regra de banco: a aba de Configurações avisa quando o horário declarado é **mais largo** do que a soma das janelas dos corretores, porque aí o agente promete ao cliente um horário que os triggers 4 e 5 vão negar. Avisa e deixa salvar, pela mesma razão de sempre — a interface antecipa, o banco decide.

### Por que `agendas` existe separada de `corretores`

Porque são coisas com ciclos de vida diferentes. `corretores` é cadastro de pessoa: nome, CRECI, contato. `agendas` é configuração de atendimento: duração do slot e, por extensão, as janelas. Separar dá um ponto de ancoragem estável para `agendas_horarios` e permite que a agenda ganhe regras próprias — bloqueios, férias, slots diferentes por período — sem inchar a tabela de cadastro. O UNIQUE em `id_corretor` mantém a relação 1:1 hoje sem fechar essa porta.

### Por que `codigo_imovel` é copiado dentro de `agendamentos`

Porque a exclusão de imóvel é definitiva e `id_imovel` usa SET NULL. Sem a cópia, o histórico de uma visita realizada em um imóvel já vendido vira um registro sem nada que identifique o que foi visitado. Com a cópia, o painel continua mostrando "visita ao IMV-0042" para sempre. É desnormalização proposital: o código é imutável e serve como referência histórica, não como chave de junção.

### Por que `tipos_imovel` é tabela e não lista fixa

Porque o vocabulário do mercado muda por região e o sistema é replicável. Imobiliária de praia precisa de flat e frente-mar, a de interior precisa de fazenda e haras, a de capital precisa de loft e studio. Com lista fixa em código ou em `enum`, cada nova imobiliária vira um deploy. Como tabela, é o dono que edita pelo painel, e o `enum` do Postgres — que exige `ALTER TYPE` e não permite remover valor — deixa de ser um problema.

### Por que os contadores vivem em `imoveis` em vez de serem calculados sob demanda

Porque a leitura é muito mais frequente que a escrita. `total_visualizacoes` e `total_cliques_whatsapp` aparecem no dashboard, no ranking de imóveis mais vistos e na listagem do painel — a cada carregamento de página. Calcular por `count()` sobre `visualizacoes_site` significaria varrer uma tabela que só cresce, várias vezes por tela. Com o contador materializado na linha do imóvel, a leitura é um campo já presente no `SELECT` que a página já faz, e o custo é um `UPDATE` de uma linha no momento do evento. `visualizacoes_site` continua guardando o detalhe para análises que precisem de recorte por data ou origem.

### Por que a visualização deduplica por sessão e o clique não

São intenções diferentes. Recarregar a página do imóvel não é interesse novo: sem deduplicação, um corretor abrindo o próprio anúncio cinco vezes coloca o imóvel no topo do ranking de mais vistos e o ranking deixa de significar qualquer coisa. Já clicar no botão de WhatsApp duas vezes é intenção real, muitas vezes de duas conversas diferentes, e abafar isso esconderia justamente o sinal que mais interessa — o imóvel que faz o telefone tocar.

A deduplicação compara `(created_at, id)` com a linha nova, e não simplesmente "existe outra linha da mesma sessão". A diferença importa: num `INSERT` de várias linhas, o trigger `AFTER` dispara com todas as linhas já visíveis na tabela, e a comparação ingênua faria duas visualizações da mesma sessão se anularem mutuamente — o contador ficaria em zero. Com o desempate ordenado, exatamente a primeira linha de cada sessão incrementa.

### Como o rastreamento da vitrine foi implementado

O registro vive em `src/lib/rastreamento.ts` e é o único caminho pelo qual o site escreve em `visualizacoes_site`.

**O identificador de sessão.** É um UUID aleatório gerado no primeiro acesso por `crypto.randomUUID()` e guardado em `sessionStorage`. Não é derivado de nada do visitante: não há IP, não há impressão digital de navegador, não há nada que identifique pessoa — e por isso não dá para ligar duas sessões da mesma pessoa, que é a intenção.

Fica em `sessionStorage`, e não em `localStorage`, porque a deduplicação precisa valer **durante a visita**, não para sempre. Quem volta na semana seguinte com interesse renovado é visita nova, e faz sentido que conte de novo. Em navegação anônima com armazenamento bloqueado, `idDaSessao` devolve `null`: o evento ainda é gravado, só não deduplica.

**Como ele encontra o trigger 10.** O `session_id` só existe para alimentar a deduplicação descrita na seção 3. O trigger incrementa `imoveis.total_visualizacoes` apenas quando não há visualização anterior daquela sessão para aquele imóvel. Sem o identificador, cada F5 viraria visualização nova e o ranking de mais vistos passaria a medir quem recarregou a página.

A ponta do frontend e a ponta do banco foram verificadas juntas, pelo caminho anônimo real:

- Duas visualizações do mesmo imóvel com o **mesmo** `session_id` → contador sobe **1**
- Uma terceira, com `session_id` diferente → contador sobe para **2**
- Dois `clique_whatsapp` da mesma sessão → contador de cliques sobe **2**, porque clique não deduplica (ver seção 3)

**O que não é registrado.** Acesso da equipe não conta. O critério é a existência de sessão autenticada, e não a origem do clique: quem tem sessão do painel é a equipe, tenha chegado pelo link "Ver site" ou digitando o endereço. Um parâmetro na URL seria contornado no primeiro F5, e o problema real não é o link — é o operador que deixa a vitrine aberta numa aba enquanto trabalha e infla sozinho o ranking que existe para dizer o que o *cliente* procura.

**Nunca bloqueia e nunca lança.** Todas as funções devolvem `void` e engolem o próprio erro. Vale especialmente para o clique de WhatsApp: é o evento que vira lead, e segurar a navegação para gravar um contador seria trocar o resultado pela medição do resultado.

**Escrita sem leitura.** A política de RLS dá ao papel `anon` apenas `insert` em `visualizacoes_site` — verificado: o visitante grava o evento e não consegue ler nenhum de volta, nem o próprio.

### Por que `id_corretor` usa RESTRICT enquanto `id_imovel` usa SET NULL em `agendamentos`

Porque as consequências de perder a referência são opostas. A visita é um compromisso entre duas pessoas: apagar o corretor e deixar a visita órfã produz um agendamento que ninguém vai cumprir e que ninguém sabe de quem era. RESTRICT força a decisão consciente — desative o corretor (`ativo = false`, que preserva tudo) ou reatribua as visitas antes de excluir. Já o imóvel some por design, e a visita a um imóvel que saiu da carteira continua sendo um fato válido do histórico: SET NULL apaga o vínculo mas mantém o registro, e o `codigo_imovel` copiado preserva o que foi visitado.

### Por que os dados da imobiliária têm uma view própria para o agente

`info_imob_agente` (seção 2.14) existe porque o agente de IA lê o banco **direto pelo N8N**, com service role, do mesmo jeito que já escreve os leads. Para esse consumidor, `select informacoes from info_imob_agente` é um node só, e o que volta já é a frase final.

**Por que uma coluna e não dez.** Entregues em colunas separadas, os dados obrigariam o agente a compor a resposta, e é exatamente aí que ele inventa "Instagram: não informado", emenda uma vírgula sobrando ou inverte cidade e estado. Composição é a operação em que um modelo erra sem avisar. A frase sai montada do banco e o agente só repassa.

**Por que view e não tabela.** Uma tabela espelho precisaria de trigger de sincronia com `configuracoes`. No dia em que o trigger falhasse, ou em que alguém escrevesse com service role por outro caminho, o agente passaria a informar o telefone antigo **sem nada indicar o motivo** — a consulta continuaria respondendo, com o dado errado. A view lê a origem toda vez e não tem esse estado para divergir.

**O endpoint `GET /imobiliaria` foi removido quando a view nasceu.** Ele montava a mesma frase em TypeScript, em `montarFrase`, e mantê-lo significaria a regra em duas cópias. A divergência não era hipotética: no dia em que a view entrou, ela já incluía o e-mail (que o endpoint não trazia) e já quebrava linha entre os itens (o endpoint juntava com espaço). O agente responderia diferente conforme o caminho que usasse.

Era o mesmo defeito registrado em "Por que `whatsapp` é UNIQUE em `crm_imobiliaria`": a regra em cópias, corrigida numa delas e esquecida na outra por semanas. **A escolha aqui foi eliminar a cópia, não sincronizá-la.**

Sobrou a view, e o custo caiu junto: uma consulta em vez de uma requisição autenticada, sem gastar token nem requisição da janela do minuto, e sem um node de HTTP no fluxo do N8N.

**Não recrie esse endpoint** sem antes decidir qual dos dois passa a ser a fonte. O rótulo `api_imobiliaria_consultada` continua em `src/lib/auditoria.ts` de propósito: as chamadas que o endpoint recebeu enquanto existiu estão gravadas em `logs_sistema`, que não aceita update nem delete.

---

## 4. Triggers

São 11 regras. Dez são triggers de fato; a 11ª é declarativa.

### 1. `updated_at` automático

**Função:** `fn_set_updated_at()`
**Evento:** `BEFORE UPDATE` em `usuarios`, `api_tokens`, `configuracoes`, `crm_imobiliaria`, `tipos_imovel`, `imoveis`, `corretores`, `agendas`, `agendamentos`.

Preenche `updated_at` com `now()`. Previne o `updated_at` que só é atualizado quando a aplicação lembra — e que, por isso, não serve para ordenar por "modificado recentemente" nem para sincronização incremental.

### 2. Geração automática do código do imóvel

**Função:** `fn_gerar_codigo_imovel()`
**Evento:** `BEFORE INSERT` em `imoveis`.

Gera `IMV-XXXX` a partir da sequence `seq_codigo_imovel`, com zeros à esquerda até quatro dígitos e crescimento natural além disso (`IMV-0001`, `IMV-0042`, `IMV-12500`).

Detalhe de implementação que evita um bug silencioso: `lpad` **trunca** strings maiores que o tamanho pedido, então `lpad('12500', 4, '0')` devolveria `1250`. A função só aplica `lpad` quando o número tem menos de quatro dígitos.

Previne dois problemas: código digitado à mão, que colide e erra; e geração aleatória, que exige verificar colisão e repetir. Sequence nunca colide e não precisa de retry.

### 3. Criação automática da agenda do corretor

**Função:** `fn_criar_agenda_corretor()`
**Evento:** `AFTER INSERT` em `corretores`.

Cria a linha em `agendas` com `duracao_slot = 30` e popula `agendas_horarios` com segunda a sexta, 09:00 às 18:00, todos ativos.

Previne o pior tipo de bug: o silencioso. Sem a janela padrão, o corretor recém-cadastrado não tem nenhum horário, a API responde "sem disponibilidade" e nada no sistema indica o motivo. O dono ajusta a janela depois pelo painel.

### 4. Validação de conflito de horário

**Função:** `fn_validar_conflito_agendamento()`
**Evento:** `BEFORE INSERT OR UPDATE` em `agendamentos`.

Bloqueia agendamento que se sobreponha a outro do mesmo corretor com status `agendada` ou `realizada`. Cancelados e reagendados não ocupam a agenda, e a validação é pulada quando o próprio registro está sendo cancelado.

A mensagem sai em português e com o horário do conflito já convertido para o fuso configurado: *"Conflito de agenda: o corretor já possui uma visita das 17/08/2026 10:00 às 10:30 nesse intervalo."*

Previne o corretor em dois lugares ao mesmo tempo. Deixar essa validação só na aplicação não resolve: o agente de IA escreve pela API, e a corrida entre painel e agente é justamente onde o conflito aparece.

### 5. Validação de janela de atendimento

**Função:** `fn_validar_janela_atendimento()`
**Evento:** `BEFORE INSERT OR UPDATE` em `agendamentos`.

Converte `data_hora_inicio` e `data_hora_fim` para o fuso configurado, extrai o dia da semana e verifica se existe janela ativa em `agendas_horarios` que contenha o intervalo inteiro. Mensagem: *"Horário fora da janela de atendimento: o corretor não atende segunda-feira das 07:00 às 07:30."*

Previne visita marcada às 7h da manhã ou no domingo porque o agente de IA não conhecia a agenda do time.

### 6. Limite de fotos por imóvel

**Função:** `fn_validar_limite_fotos()`
**Evento:** `BEFORE INSERT` em `imoveis_fotos`.

Bloqueia a inserção quando o imóvel já tem 10 fotos: *"Limite de fotos atingido: cada imóvel aceita no máximo 10 fotos."*

Previne galeria infinita, custo de storage sem controle e página de imóvel que demora a carregar. Validado no banco porque a interface não é o único caminho de escrita.

### 7. Lead vira cliente automaticamente

**Função:** `fn_lead_vira_cliente()`
**Evento:** `AFTER UPDATE` em `crm_imobiliaria`, com cláusula `WHEN`.

Quando `status` muda para `visitou`, promove `tipo` para `cliente`.

**Encadeamento com o trigger 8.** O trigger 8 escreve em `crm_imobiliaria`, o que dispara este trigger, que escreve de novo na mesma tabela — recursão infinita se não houver guarda. A proteção é dupla: a cláusula `WHEN` do trigger e a condição dentro da função exigem que `status` tenha mudado de fato nesta operação (`OLD.status is distinct from NEW.status`) **e** que `tipo` ainda não seja `cliente`. A segunda escrita não satisfaz nenhuma das duas e o encadeamento para.

**Consequência para quem escreve na aplicação: o `RETURNING` não enxerga a promoção.** Como este trigger é `AFTER UPDATE` e faz um segundo `UPDATE`, o `RETURNING` do primeiro devolve a linha como ela ficou antes dele — ou seja, ainda com `tipo = 'lead'`. Verificado: mover o status para `visitou` com `returning tipo` devolve `lead`, e a releitura da mesma linha, na mesma transação, devolve `cliente`.

É por isso que `mudarStatusLead`, em `src/lib/leads.ts`, **relê a linha depois de atualizar** em vez de aproveitar o retorno do `update`. Sem a releitura, o card voltaria para a tela dizendo "Lead" logo depois de a pessoa ter virado cliente, e só uma recarga manual mostraria a verdade. Vale para qualquer código futuro que altere status por aqui, inclusive o da API da Etapa 9.

### 8. Sincronização de status entre agendamento e lead

**Função:** `fn_sincronizar_status_lead()`
**Evento:** `AFTER INSERT OR UPDATE` em `agendamentos`.

- **Criação:** lead vai para `agendou`, com `data_agendamento` e `id_agendamento` preenchidos.
- **Mudança para `realizada`:** lead vai para `visitou` — o que dispara o trigger 7 e o promove a cliente.
- **Mudança para `cancelada`:** antes de rebaixar, procura outro agendamento do mesmo lead com status `agendada`. Se existir, o lead **permanece em `agendou`** e `data_agendamento`/`id_agendamento` passam a apontar para a próxima visita ativa. Só quando não resta nenhuma é que o lead vai para `cancelou`, com os dois campos zerados.
- **Remarcação no mesmo registro:** se o horário muda e o status continua `agendada`, `data_agendamento` acompanha.

A verificação antes do rebaixamento previne o erro mais caro do funil: lead com três visitas marcadas que cancela uma e é rebaixado para `cancelou`, sumindo da coluna certa do Kanban enquanto ainda tem duas visitas confirmadas.

### 9. Cálculo de `minutos_ultima_mensagem`

**Função:** `fn_calcular_minutos_ultima_mensagem()`
**Evento:** `BEFORE UPDATE` em `crm_imobiliaria`.

Quando `ultima_mensagem` muda, recalcula a diferença em minutos para `now()`. Se `ultima_mensagem` for anulada, o campo também é.

Dá à régua de follow-up um número pronto para filtrar e ordenar, sem cálculo na aplicação.

**Ele sozinho grava um retrato, não um relógio.** O valor congela no instante da escrita, e é o job da seção 4.1 que o faz envelhecer. Duas consequências de forma: o trigger é `BEFORE UPDATE` e não pega o INSERT, então lead novo nasce com a coluna nula até a primeira passagem do job; e a coluna não é a fonte do painel, que recalcula na exibição por `tempoRelativo`.

### 10. Contadores de visualização e clique

**Função:** `fn_atualizar_contadores_imovel()`
**Evento:** `AFTER INSERT` em `visualizacoes_site`.

- `visualizacao` com `id_imovel`: incrementa `total_visualizacoes` **apenas na primeira linha de cada `session_id`** para aquele imóvel.
- `clique_whatsapp`: incrementa `total_cliques_whatsapp` sempre.

A justificativa da assimetria e do critério de desempate está na seção 3.

### 11. Proteção na exclusão de tipo de imóvel

**Declarativa,** não é trigger: a FK `imoveis.id_tipo_imovel` com **ON DELETE RESTRICT** já impede excluir um tipo em uso. Previne o cadastro que perde a categoria e some dos filtros do site sem que ninguém entenda o motivo.

### Extra — Espelhamento de `auth.users` em `usuarios`

**Função:** `fn_espelhar_usuario_auth()`
**Evento:** `AFTER INSERT` em `auth.users`.

Ao criar um usuário em **Authentication > Users**, o registro correspondente em `public.usuarios` é criado automaticamente, com `nome` vindo de `raw_user_meta_data` (`nome`, `full_name` ou `name`) e, na ausência dos três, da parte do email antes do `@`.

Elimina o passo manual de copiar o UUID do Auth e inserir na tabela — passo que, esquecido, produz um usuário que faz login mas não existe para o sistema.

A inserção é envolvida em bloco `EXCEPTION`: se falhar, emite `warning` e **não derruba a criação do usuário no Auth**. Um espelho quebrado é um problema de dado; um Auth quebrado é um sistema fora do ar.

### Nota sobre `SECURITY DEFINER`

Todas as funções de trigger, exceto `fn_calcular_minutos_ultima_mensagem` (que só toca `NEW`), são `SECURITY DEFINER` com `search_path` fixo em `public, pg_temp`.

É necessário: o site público escreve em `visualizacoes_site` como `anon`, e o trigger 10 precisa fazer `UPDATE` em `imoveis` — tabela em que `anon` não tem permissão de escrita nenhuma. Sem `SECURITY DEFINER`, o contador falharia e derrubaria o registro da visita junto. O `search_path` fixo é a contrapartida obrigatória de segurança.

A segunda contrapartida é revogar o `EXECUTE`. O Postgres concede `EXECUTE` a `PUBLIC` por padrão em toda função nova, e o PostgREST expõe o que `anon` pode executar em `/rest/v1/rpc/<nome>` — o que colocaria funções que rodam como `postgres` ao alcance de qualquer visitante. A migration `…012_hardening_funcoes.sql` revoga `EXECUTE` das doze funções para `public`, `anon` e `authenticated`.

Isso não quebra os triggers: o Postgres verifica `EXECUTE` sobre a função **no momento em que o trigger é criado**, não a cada disparo. A suíte de testes foi reexecutada depois da revogação, com os 24 casos passando, e o linter de segurança do Supabase passou a reportar zero alertas.

---

## 4.1 O job de relógio

Existe **um** job de `pg_cron`, criado na migration `…024`:

| Nome | Agenda | Comando |
|---|---|---|
| `minutos_ultima_mensagem` | `* * * * *` | `select public.fn_atualizar_minutos_ultima_mensagem();` |

Ele reescreve `minutos_ultima_mensagem` em todo lead que tenha `ultima_mensagem`, para que o número seja o real e não o do instante da última mensagem.

**Por que gravar em vez de calcular na leitura.** Calcular sairia de graça e sempre exato, e é o que o painel faz. Mas quem consome esta coluna é o agente de IA lendo `crm_imobiliaria` direto pelo N8N, sem view e sem endpoint no caminho. Para esse leitor, a coluna precisa estar certa na própria tabela.

A contrapartida assumida: cada rodada cria uma versão nova de cada linha com conversa. Com centenas de leads é irrelevante; na casa das dezenas de milhares vale reavaliar, e a saída natural é restringir o job aos leads com atividade recente.

**Duas coisas precisaram de guarda para o job não estragar o que já existia.**

`updated_at` responde "quando esse lead foi mexido pela última vez". Sem guarda, o job passaria a carimbá-lo a cada minuto em todo lead, e a coluna passaria a responder "há um minuto" para sempre, sobre todos. Por isso `trg_crm_imobiliaria_updated_at` ganhou um `WHEN` que compara a linha inteira **menos** `minutos_ultima_mensagem` e `updated_at`: mudou outra coisa, carimba; mudou só o relógio, não é alteração do lead.

O **Funil** ouve `crm_imobiliaria` por Realtime, e o job vira um evento de UPDATE por lead, por minuto. O estrago não seria a consulta a mais: recarregar uma coluna do Kanban a devolve à primeira página, então quem tivesse clicado em "carregar mais" perderia o que abriu, sozinho, de minuto em minuto. A saída antecipada é `soMudouORelogio`, em `src/lib/leads.ts`, e ela só é possível porque a tabela está em `replica identity full` — com a identidade padrão, `payload.old` traria só a chave primária e não haveria o que comparar.

**O job não grava em `logs_sistema`**, de propósito. A trilha registra ação de gente e do agente; 1.440 linhas por dia sobre o relógio andando enterrariam o que se procura ali.

**Ele não fecha a lacuna do INSERT.** O trigger 9 continua sendo `BEFORE UPDATE`, então o lead novo do upsert do agente nasce com a coluna nula. O job a preenche na passagem seguinte, em no máximo 60 segundos, e é por isso que a lacuna não virou problema.

Para conferir se está de pé:

```sql
select status, return_message, start_time
from cron.job_run_details d
join cron.job j using (jobid)
where j.jobname = 'minutos_ultima_mensagem'
order by start_time desc limit 5;
```

---

## 5. Políticas de RLS

RLS ativo nas 13 tabelas. A política padrão é: **usuário autenticado pode tudo**. As exceções estão marcadas.

| Tabela | `anon` (site público) | `authenticated` (painel) | `service_role` (API / agente de IA) |
|---|---|---|---|
| `usuarios` | — | ALL | — |
| `api_tokens` | — | ALL | — |
| `configuracoes` | **SELECT** | ALL | — |
| `logs_sistema` | — | **SELECT + INSERT apenas** | — |
| `crm_imobiliaria` | — | ALL | **SELECT + INSERT + UPDATE** |
| `tipos_imovel` | **SELECT** | ALL | — |
| `imoveis` | **SELECT onde `status = 'ativo'`** | ALL | — |
| `imoveis_fotos` | **SELECT onde o imóvel pai está ativo** | ALL | — |
| `corretores` | — | ALL | — |
| `agendas` | — | ALL | — |
| `agendas_horarios` | — | ALL | — |
| `agendamentos` | — | ALL | **SELECT + INSERT + UPDATE + DELETE** |
| `visualizacoes_site` | **INSERT** | ALL | — |

**Notas de leitura da tabela:**

- **`imoveis`.** A restrição a `status = 'ativo'` vive na política, não na consulta do frontend. Desativar um imóvel o remove da vitrine mesmo que alguma tela esqueça o filtro.
- **`imoveis_fotos`.** A política de `anon` usa subconsulta em `imoveis` verificando `status = 'ativo'`. Sem isso, as fotos de um imóvel desativado continuariam acessíveis por URL direta da API — vazamento silencioso do que se acreditava fora do ar.
- **`logs_sistema`.** Só `SELECT` e `INSERT`. Não existe política de `UPDATE` nem de `DELETE` para ninguém: log que pode ser editado não é auditoria.
- **`visualizacoes_site`.** `anon` tem `INSERT` e **não tem `SELECT`** — o rastreamento é de escrita apenas. Consequência prática para o frontend: a inserção **não pode pedir o registro de volta**. Em `supabase-js`, use `.insert(...)` sem encadear `.select()`; encadear provoca `401`.
- **`api_tokens`.** Nunca exposta a `anon`. A validação do token acontece na Edge Function, que roda com `service_role`.
- **`service_role`.** No Supabase esse papel já tem `BYPASSRLS`, então as políticas acima são redundantes na prática. Foram criadas mesmo assim para que a intenção fique explícita no schema, e não apenas no comportamento do papel.

---

## 6. Storage

Dois buckets, ambos **públicos**.

| Bucket | Público | Limite por arquivo | Tipos permitidos | Uso |
|---|---|---|---|---|
| `logos` | sim | 5 MB | PNG, JPEG, WEBP, SVG | Logo da imobiliária, referenciado em `configuracoes.logo_url` |
| `imoveis` | sim | 10 MB | PNG, JPEG, WEBP | Fotos dos imóveis, referenciadas em `imoveis_fotos.url` |

SVG é permitido só em `logos` porque logo costuma ser vetor. Em `imoveis` fica de fora de propósito: foto de imóvel não é vetor, e SVG carrega script.

**Políticas em `storage.objects`:**

- `SELECT` para `public` nos dois buckets — o site serve as imagens direto do Storage
- `INSERT`, `UPDATE` e `DELETE` apenas para `authenticated` — upload é ação do painel

### Como as fotos de imóvel são armazenadas

Implementado na Etapa 3. O código vive em `src/lib/armazenamento.ts` (Storage), `src/lib/imagens.ts` (compressão) e `src/lib/fotosImovel.ts` (sincronização).

**Caminho do arquivo:** `<id_do_imovel>/<uuid>.webp`, dentro do bucket `imoveis`.

Agrupar por imóvel, em vez de jogar tudo na raiz, permite apagar a pasta inteira na exclusão com uma chamada só. Isso importa mais do que parece: quando chega a hora de limpar o Storage, as linhas de `imoveis_fotos` **já sumiram** por `ON DELETE CASCADE`, então não há de onde ler a lista de URLs. O nome do arquivo é um UUID, e não o nome original, para evitar colisão e para não expor "IMG_20260810_fachada_frente.jpg" na URL pública.

**Montagem da URL:** `supabase.storage.from('imoveis').getPublicUrl(caminho).data.publicUrl`, que devolve `https://<projeto>.supabase.co/storage/v1/object/public/imoveis/<caminho>`. Essa URL completa é salva em `imoveis_fotos.url`, e tanto o painel quanto o site renderizam direto dela, sem passar pela API. O caminho de volta — necessário para apagar o arquivo — é extraído da URL por `caminhoDaUrl()`.

Guardar a URL inteira em vez do caminho é desnormalização proposital: economiza uma montagem em toda renderização de card, e o custo é ter que reescrever as linhas caso o projeto Supabase mude de domínio, o que acontece uma vez ou nenhuma.

**Compressão no cliente**, antes do upload, em `comprimirImagem()`:

1. `createImageBitmap(arquivo, { imageOrientation: 'from-image' })` — o `imageOrientation` aplica a rotação do EXIF; sem ele, foto tirada na vertical pelo celular sobe deitada
2. Redimensiona para no máximo **1920px no maior lado**, preservando proporção
3. Desenha em `<canvas>` e exporta em **WEBP com qualidade 0.82**
4. Se o resultado ficar maior que o original e não houve redimensionamento, mantém o original
5. Se qualquer etapa falhar, devolve o arquivo original — foto grande é melhor do que foto nenhuma

Sem dependência externa: `createImageBitmap` e `canvas` bastam. Foto de imóvel chega de celular com 4 a 12 MB, e a vitrine é justamente a parte do sistema que mais precisa ser rápida.

**Sincronização da galeria** (`sincronizarFotos`). A ordem das operações é imposta por duas restrições do banco e não pode ser mudada à toa:

1. **Remover primeiro** as fotos que saíram — banco e Storage. Antes das inserções, porque o trigger 6 limita a 10 fotos: trocar 3 fotos num imóvel que já tem 10 estouraria o limite no meio do caminho
2. **Zerar todas as capas** do imóvel, numa única atualização
3. **Enviar as fotos novas** e inserir as linhas, todas com `capa = false`
4. **Atualizar a `ordem`** das que já existiam
5. **Definir a capa** por último, numa linha só

Os passos 2 e 5 existem por causa do índice único parcial `uidx_imoveis_fotos_capa_unica`. Numa reordenação é trivial existirem duas capas por um instante, e o banco recusaria a operação inteira. Zerar antes e definir depois elimina a janela. Sem escolha explícita do usuário, a primeira foto da ordem vira capa.

**Atenção na exclusão.** `ON DELETE CASCADE` apaga as linhas de `imoveis_fotos`, mas **não apaga os arquivos do Storage** — banco e object storage são sistemas separados. `excluirImovel()` cuida disso, e a ordem também importa ali: log completo → delete no banco → limpeza do Storage. Se a limpeza falhar, sobra arquivo órfão, que é muito menos grave do que um registro que não pôde ser apagado.

### Uma observação sobre lacunas na numeração dos códigos

Sequences do Postgres **não são transacionais**: o número é consumido mesmo quando o `INSERT` falha depois, por constraint ou por erro da aplicação. Na prática, uma tentativa de salvar um imóvel à venda sem preencher o valor de venda queima um código, e o próximo imóvel salvo com sucesso recebe `IMV-0002` em vez de `IMV-0001`.

Isso é esperado e não é defeito. A sequence garante o que precisa garantir — que dois imóveis nunca recebam o mesmo código, sem lógica de retry. Numeração contínua exigiria travar a tabela a cada inserção, trocando um cosmético por um gargalo. O código é identificador, não contador.

---

## 7. Primeiro usuário do painel

Não existe tela de cadastro: usuários são criados exclusivamente pelo desenvolvedor.

1. Supabase → **Authentication > Users** → **Add user**, com email e senha
2. Pronto. O trigger `trg_auth_users_espelhar_usuario` cria o registro em `public.usuarios` automaticamente

Para conferir, ou para ajustar o nome exibido:

```sql
select id, nome, email from public.usuarios;
update public.usuarios set nome = 'Nome Completo' where email = 'usuario@exemplo.com';
```

Se o espelhamento falhar por algum motivo, o registro pode ser inserido à mão com o mesmo `id` do Auth:

```sql
insert into public.usuarios (id, nome, email)
values ('<uuid-vindo-de-auth.users>', 'Nome Completo', 'usuario@exemplo.com');
```

---

## 8. Histórico de alterações do banco

- **Etapa 1** — Schema completo: 13 tabelas, 11 regras de trigger (10 triggers + 1 constraint declarativa), trigger extra de espelhamento de `auth.users`, políticas de RLS, Realtime em `crm_imobiliaria` e `agendamentos`, buckets `logos` e `imoveis`, seed de `configuracoes` e `tipos_imovel`. Encerrada com endurecimento das funções (`…012_hardening_funcoes.sql`) e linter de segurança do Supabase em zero alertas.

### Extensões necessárias

Um banco novo do ImobFlow precisa de duas extensões. **As migrations criam as duas**, então não há passo manual em projeto Supabase; a lista existe para quem for provisionar fora do Supabase ou diagnosticar uma instalação que se comporta de forma estranha.

| Extensão | Criada em | Para quê | Se faltar |
|---|---|---|---|
| `pgcrypto` | `…001` | `gen_random_uuid()`, a chave primária de toda tabela | A migration falha na hora, com erro claro |
| `pg_cron` | `…024` | O job que envelhece `minutos_ultima_mensagem` (seção 4.1) | **Nada falha. A coluna congela em silêncio** |

**A diferença da última coluna é o motivo desta seção existir.** Sem `pgcrypto` nada funciona e o erro aparece no primeiro comando. Sem `pg_cron` o sistema inteiro sobe normalmente: o painel funciona, a API responde, a vitrine publica. O único sintoma é `minutos_ultima_mensagem` parada no valor do instante da última mensagem, e quem sofre com isso é o agente de IA, que decide follow-up por aquele número, dentro de uma conversa que ninguém no painel está lendo.

No Supabase a extensão já vem disponível e a migration `…024` a ativa sozinha com `create extension if not exists pg_cron`. Fora do Supabase ela exige `shared_preload_libraries = 'pg_cron'` no `postgresql.conf` **e reinício do servidor**, e só roda no banco apontado por `cron.database_name`, que por padrão é `postgres`.

Depois de aplicar as migrations num banco novo, confira que o job existe:

```sql
select jobname, schedule, active from cron.job;
-- esperado: minutos_ultima_mensagem | * * * * * | t
```

E que ele está rodando sem erro:

```sql
select status, return_message, start_time
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'minutos_ultima_mensagem'
order by start_time desc limit 5;
```

Lista vazia na primeira consulta significa que a `…024` não chegou a ser aplicada, ou que a extensão não subiu. Lista vazia na segunda, com o job existindo, significa que o `pg_cron` está instalado mas não está executando, que é o caso do `shared_preload_libraries` ausente.

### Migrations

Aplicar **em ordem numérica**. Estão em [supabase/migrations/](supabase/migrations/).

| Arquivo | Conteúdo |
|---|---|
| `…001_base_e_timezone.sql` | Timezone `America/Sao_Paulo`, `pgcrypto`, `fn_set_updated_at()` |
| `…002_tabelas_padrao.sql` | `usuarios`, `api_tokens`, `configuracoes`, `logs_sistema` |
| `…003_crm_imobiliaria.sql` | `crm_imobiliaria` |
| `…004_imoveis.sql` | `tipos_imovel`, `seq_codigo_imovel`, `imoveis`, `imoveis_fotos` |
| `…005_corretores_agenda.sql` | `corretores`, `agendas`, `agendas_horarios`, `agendamentos` |
| `…006_visualizacoes_site.sql` | `visualizacoes_site` |
| `…007_funcoes_e_triggers.sql` | As 11 regras + espelhamento de `auth.users` |
| `…008_rls.sql` | RLS e políticas das 13 tabelas |
| `…009_realtime_storage.sql` | Realtime e criação dos buckets |
| `…010_storage_policies.sql` | Políticas de `storage.objects` |
| `…011_seed.sql` | Seed de `configuracoes` e `tipos_imovel` |
| `…012_hardening_funcoes.sql` | Revogação de `EXECUTE` e `search_path` fixo |
| `…013_realtime_configuracoes.sql` | Etapa 2 — `configuracoes` na publicação de Realtime |
| `…014_configuracoes_foto_hero.sql` | Etapa 6 — `configuracoes.foto_hero_url` |
| `…015_dashboard_agregacoes.sql` | Etapa 7 — as oito funções de agregação do Dashboard |
| `…016_logs_consulta.sql` | Etapa 8 — leitura da trilha de auditoria: categoria, listagem paginada e opções de filtro |
| `…017_api_publica.sql` | Etapa 9 — `api_uso`, `fn_api_autenticar` e a categoria `api` em `fn_log_categoria` |
| `…020_whatsapp_com_codigo_pais.sql` | Normalização de `crm_imobiliaria.whatsapp` para E.164 sem o mais |
| `…021_configuracoes_url_site.sql` | Etapa 9 — `configuracoes.url_site`, base do link que o agente manda |
| `…022_info_imob_agente.sql` | View `info_imob_agente` e `fn_telefone_legivel` (seção 2.14) |
| `…023_horario_funcionamento.sql` | Etapa 8 — `configuracoes.horario_funcionamento` e a frase legível na view (seção 2.3) |
| `…024_minutos_ultima_mensagem_cron.sql` | `pg_cron` e o job que envelhece `minutos_ultima_mensagem` (seção 4.1) |
| `…025_seed_imoveis_sp_zona_sul_oeste.sql` | **Demonstração.** 30 imóveis fictícios: 15 apartamentos para locação, 10 para venda e 5 casas no interior |

A migration `…025` é de demonstração e **sai antes de divulgar o site**. O comando está no README. Ela é a única de conteúdo: todas as outras são estrutura.

### Verificação da Etapa 1

O schema foi validado contra o banco provisionado, em 24 casos de teste que exercitaram cada trigger e cada constraint pelo caminho real de escrita — inclusive o RLS anônimo via PostgREST, com dedução de contador ponta a ponta. Todos passaram; os dados de teste foram removidos e a sequence do código voltou para 1, de forma que o primeiro imóvel cadastrado receba `IMV-0001`.

Um caso mereceu correção durante a verificação: a deduplicação de visualizações comparava apenas "existe outra linha da mesma sessão", o que fazia duas visualizações inseridas na mesma instrução se anularem. A correção está descrita na seção 3.

- **Etapa 2** — `configuracoes` adicionada à publicação `supabase_realtime`, com `replica identity full` (migration `…013`).

  **Por quê.** O painel mantém uma subscription em `configuracoes` para que o que o dono salva na tela de Configurações apareça na sidebar sem recarregar a página. A Etapa 1 publicou apenas `crm_imobiliaria` e `agendamentos`, então essa subscription conectava normalmente e nunca recebia evento nenhum — sem erro no console e sem nada apontando a causa. Entrega verificada ponta a ponta com `supabase-js`: o `UPDATE` em `configuracoes` chega ao cliente inscrito.

  Realtime ativo hoje em três tabelas: `crm_imobiliaria`, `agendamentos` e `configuracoes`.

- **Etapa 4** — nenhuma alteração de schema. Corretores e Agenda foram construídos sobre o que a Etapa 1 já definia.

  ### Como a criação automática da agenda foi validada

  O trigger 3 (`fn_criar_agenda_corretor`) foi verificado inserindo um corretor pelo mesmo caminho que a interface usa — `insert` só na tabela `corretores`, sem tocar em `agendas` — e conferindo o que apareceu do outro lado:

  - Uma linha em `agendas`, com `duracao_slot = 30`
  - Cinco linhas ativas em `agendas_horarios`, `dia_semana` de 1 a 5, das `09:00` às `18:00`

  Também foi confirmado que uma segunda `agendas` para o mesmo corretor é recusada pelo `UNIQUE` em `agendas.id_corretor`. Isso importa para o frontend: `criarCorretor()` **não cria a agenda**. Duplicar o trabalho do trigger não daria erro silencioso — daria erro de unicidade no cadastro do primeiro corretor.

  ### Como os horários padrão chegam ao formulário de edição

  O caminho é: trigger grava → `listarCorretores()` traz por junção aninhada (`corretores → agendas → agendas_horarios`) → `janelaParaFormulario()` normaliza.

  A normalização existe porque o formulário mostra **sempre sete linhas**, uma por dia, enquanto o banco guarda apenas os dias configurados. Dias sem linha viram `ativo: false` com o horário padrão preenchido, de forma que ligar o sábado não obrigue a digitar o horário do zero. O `.slice(0, 5)` corta o `:00` dos segundos que o tipo `time` do Postgres devolve — `<input type="time">` não aceita `09:00:00`.

  Ao salvar, `salvarJanela()` **apaga todas as linhas do corretor e reinsere as sete**, inclusive as inativas. Reconciliar linha a linha economizaria pouco e abriria espaço para duas linhas do mesmo dia, que a interface não sabe representar. Gravar as inativas preserva o horário configurado de um dia temporariamente desligado.

  ### Verificação

  18 casos contra o banco real, cobrindo a cascata inteira do funil: criar visita move o lead para `agendou`; cancelar uma de duas mantém o lead em `agendou` apontando para a próxima; cancelar a última rebaixa para `cancelou`; marcar como realizada promove a `visitou` e, pelo encadeamento do trigger 7, a `cliente`. Também: recusa de horário fora da janela, recusa de conflito, revalidação ao mover a visita, `RESTRICT` bloqueando a exclusão de corretor com histórico, e `UNIQUE` bloqueando a segunda agenda.

  Os helpers de fuso de `src/lib/datas.ts` foram testados à parte, em 7 casos, incluindo a virada do horário de verão de 2018 — quando 00:30 de 04/11 não existiu, porque o relógio pulou de 00:00 para 01:00. A conversão resolve esse buraco para o instante imediatamente anterior, em vez de devolver data inválida.

- **Etapa 7** — oito funções de agregação para o Dashboard (migration `…015`). Nenhuma alteração de tabela.

  ### Por que as agregações vivem no banco

  `visualizacoes_site` recebe uma linha por página vista do site público. Trazer isso para o navegador para somar significaria baixar meses de tráfego a cada abertura do painel — funcionaria na demonstração e travaria no terceiro mês do cliente. Nenhuma soma acontece no frontend; `src/lib/dashboard.ts` só chama e formata.

  ### As funções

  | Função | Para que serve |
  |---|---|
  | `fn_fuso_painel()` | Fuso da imobiliária para as demais. Existe porque `fn_fuso_horario()` é SECURITY DEFINER e teve o EXECUTE revogado na `…012` — funções SECURITY INVOKER não conseguem chamá-la |
  | `fn_dashboard_indicadores(inicio, fim, inicio_ant, fim_ant)` | Os quatro números da faixa fixa **e** os do período anterior, na mesma chamada. Duas idas ao banco para montar a seta de variação dobrariam a latência do bloco que precisa aparecer primeiro |
  | `fn_dashboard_ranking_imoveis(inicio, fim, evento, limite)` | Ranking por visualização ou por clique. Devolve as duas contagens sempre, porque a taxa de conversão precisa das duas |
  | `fn_dashboard_paginas(inicio, fim)` | Páginas mais acessadas, com as de imóvel individual somadas numa linha só |
  | `fn_dashboard_serie_diaria(inicio, fim)` | Leads, atendimentos e visitas por dia, **inclusive os dias sem evento** |
  | `fn_dashboard_dia_semana(inicio, fim)` | Concentração por dia da semana. Os sete dias vêm sempre |
  | `fn_dashboard_leads_por_status()` | Quantos leads estão em cada etapa **agora**. Não é recorte de período |
  | `fn_dashboard_estoque()` e `fn_dashboard_estoque_por_tipo()` | Retrato atual da carteira: ativos, inativos, finalidade, tipo e ativos sem foto |
  | `fn_dashboard_tem_dados()` | Se existe qualquer dado no sistema, para escolher entre o Dashboard e a tela de implantação recente |

  ### Três decisões que atravessam todas elas

  **Período semiaberto.** `p_inicio` inclusivo, `p_fim` exclusivo — quem chama passa a meia-noite do dia *seguinte* ao último desejado. Elimina o `23:59:59.999`, que perde eventos gravados no último milissegundo do dia.

  **Fuso da imobiliária, nunca UTC.** O agrupamento por dia usa `configuracoes.fuso_horario`. Uma visita às 22h de segunda em São Paulo é terça em UTC: agrupar em UTC jogaria o movimento da noite para o dia seguinte, e o gráfico de dias da semana apontaria o dia errado — justamente o gráfico que existe para dimensionar equipe.

  **`generate_series` para os dias vazios.** Um gráfico que pula os dias sem evento mente sobre a forma da curva: três leads em três dias seguidos e três leads espalhados por um mês desenhariam a mesma linha, e o dono leria constância onde há um pico isolado.

  ### Privilégios

  Todas são **SECURITY INVOKER** — rodam com o papel de quem chama e o RLS continua valendo. Não há escalonamento de privilégio: `authenticated` já enxerga estas tabelas.

  Ainda assim, o EXECUTE é revogado de `public` e `anon` e concedido apenas a `authenticated`, seguindo a `…012`. O Postgres concede EXECUTE a PUBLIC por padrão, e isso exporia cada função em `/rest/v1/rpc/<nome>` — endpoints que respondem sobre leads, tráfego e agenda. O RLS já devolveria zeros ao anônimo, mas uma função que responde zeros a quem não deveria nem poder perguntar ainda confirma que o endpoint existe.

  Verificado: o anônimo é barrado nas **10 de 10** funções; o autenticado executa as **10 de 10**. Os *advisors* de segurança do Supabase seguem em zero.

  ### Verificação

  22 casos contra um cenário semeado com números conhecidos — três imóveis (dois ativos, um inativo), tráfego dentro e fora do período, cinco leads e duas visitas, uma delas cancelada.

  Entre o que foi confirmado: visita cancelada **não** entra na contagem; imóvel de finalidade `ambos` conta nas duas divisões; a conversão de 2 cliques em 5 visualizações dá exatamente 40,0%; as páginas de imóvel somam 7 acessos numa linha só enquanto a home mantém os seus 3; a série diária traz 7 linhas para um período de 7 dias **com pelo menos um dia zerado**, provando o `generate_series`; a soma da série bate com o total do indicador; e o atendimento do agente conta apenas os leads com `inicio_atendimento`, deixando de fora o lead cadastrado à mão.

- **Etapa 9** — `api_uso`, `fn_api_autenticar` e a categoria `api` em `fn_log_categoria` (migration `…017`).

  ### Como a disponibilidade é calculada

  É a lógica mais complexa do sistema, e a razão é que ela precisa **prever exatamente o que os triggers 4 e 5 vão responder**. O banco continua sendo a autoridade; o cálculo da API é antecipação. Um cálculo mais permissivo faz o agente oferecer um horário que o `insert` recusa em seguida, na frente do cliente. Um mais restritivo perde visitas que a equipe cobriria sem problema.

  O código está em `supabase/functions/_compartilhado/disponibilidade.ts`. Passo a passo:

  1. **Corretores ativos, com a janela junto.** Uma consulta só, com `corretores → agendas → agendas_horarios` aninhados. Corretor inativo não entra: ele parou de receber visitas novas, e é isso que "inativo" significa.

  2. **Dia da semana no fuso da imobiliária.** O `dia_semana` de `agendas_horarios` segue a convenção do Postgres (0 = domingo) e é calculado sobre a hora de parede local, nunca sobre UTC. Uma segunda-feira às 22h em São Paulo é terça em UTC — o cálculo pegaria a janela do dia errado.

  3. **Janela do corretor naquele dia.** A linha de `agendas_horarios` com `ativo = true` e `dia_semana` correspondente. Corretor sem linha ativa naquele dia simplesmente não gera bloco.

  4. **Blocos de 30 minutos dentro da janela.** A condição de parada é `minuto + 30 <= fecha`, e não `minuto < fecha`: o trigger 5 exige que o **fim** da visita caiba na janela. Gerar um bloco às 17h45 numa janela que fecha às 18h ofereceria um horário que o banco recusa.

  5. **Remoção dos blocos ocupados.** Um `agendamento` com status `agendada` ou `realizada` que se sobreponha ao bloco — a mesma condição do trigger 4, inclusive na exclusão de `cancelada` e `reagendada`. É isso que faz um horário cancelado voltar a ficar livre. No remarque, a própria visita é ignorada, senão ela bloquearia o horário para o qual está sendo movida.

  6. **Corte de tempo.** Blocos anteriores a `agora + ANTECEDENCIA_MINIMA_MINUTOS` (padrão 60) saem. "Livre" e "possível" não são a mesma coisa: o bloco das 15h continua vago às 14h58, e oferecê-lo marca uma visita que ninguém consegue cumprir.

  7. **Consolidação.** Os blocos são agrupados por minuto do dia, e cada um carrega **quem está livre nele**. Um horário está disponível quando **pelo menos um** corretor estiver livre — corretor é livre no ImobFlow, qualquer um conduz qualquer visita. A API não recebe corretor: perguntar "com qual corretor?" na conversa é uma pergunta que o cliente não tem como responder.

  **A consulta de ocupação cobre todos os dias pedidos de uma vez.** Isso importa porque o caso mais frequente é o de erro: quando o horário pedido não serve, a resposta precisa trazer alternativas, e alternativa boa costuma ser no dia seguinte. Buscar por dia repetiria as mesmas duas consultas sete vezes.

  ### "Ocupado" e "fora da janela" são recusas diferentes

  Quando o horário pedido não está entre os livres, a API roda o cálculo **de novo** com `apenasJanela`, que ignora ocupação e antecedência. Se o horário não aparece nem assim, a imobiliária não atende naquele momento — e a resposta é `fora_da_janela`, não `horario_ocupado`.

  A distinção não é cosmética: colapsar as duas faria o agente insistir num domingo dizendo que talvez vague.

  ### Escolha do corretor

  Entre os livres no bloco, a API pega o **menos carregado** — contagem de visitas ainda `agendada` daqui para frente. Sempre o primeiro da lista concentraria a agenda inteira em quem aparece primeiro no alfabeto, e a imobiliária descobriria isso pelo corretor reclamando. Empate é resolvido pelo id, para o resultado ser reproduzível quando alguém for depurar por que a visita caiu com fulano.

  Num remarque, quem já estava com a visita tem preferência se continuar livre: trocar o corretor sem necessidade quebra a continuidade do atendimento.

  ### `api_uso` e o limite de requisições

  Uma linha por (token, minuto), com o total. Não é log de chamadas — a trilha disso é `logs_sistema`. Linhas com mais de uma hora são descartadas, e a limpeza roda só quando uma janela nova é criada, ou seja, uma vez por minuto por token.

  **O contador precisa viver no banco.** Edge Function é efêmera e roda em várias instâncias ao mesmo tempo: um contador em memória zera a cada isolate novo e não enxerga o que as outras instâncias estão fazendo. Ou seja, não limita nada — e o pior é que parece funcionar em teste local.

  `fn_api_autenticar` faz as três coisas numa chamada: valida o token, conta a requisição e marca `ultimo_uso`. Três chamadas separadas seriam três viagens de rede em **toda** requisição da API.

  **`ultimo_uso` só é atualizado quando a chamada é aceita.** Um agente em loop sendo barrado pelo limite não deve manter o token parecendo em uso saudável na tela de Configurações.

  ### A armadilha do `returns table` com nome de coluna

  Vale registrar porque custou uma rodada inteira de verificação. Os nomes declarados no `returns table` viram variáveis dentro da função, e `id_token` é também o nome de uma coluna de `api_uso`. Sem `#variable_conflict use_column`, o `on conflict (id_token, janela)` não sabe a qual dos dois se refere e o Postgres recusa com **42702**.

  O que torna isso traiçoeiro é *onde* a falha aparece: só o caminho do token **válido** chega ao `insert`. A autenticação rejeitava corretamente todo token inválido e falhava exatamente com os válidos — o oposto do que um teste superficial de segurança procuraria.

  ### Privilégios

  `fn_api_autenticar` é SECURITY DEFINER (precisa escrever em `api_tokens`) e tem EXECUTE revogado de `public`, `anon` e `authenticated`, concedido só a `service_role`. `api_uso` tem RLS ativo e **nenhuma política**, de propósito: só o `service_role` da Edge Function toca nela. O *advisor* `rls_enabled_no_policy` do Supabase aponta essa tabela — é o desenho pretendido, não um esquecimento.

  ### Verificação

  **63 casos** pelo caminho real da API, mais **6** de limite, distribuição e trilha.

  Entre o confirmado: token inexistente e token revogado devolvem a mesma resposta, sem distinguir os dois; rota inexistente **sem** token responde 401 e não 404, para não entregar o mapa da API; a ficha do imóvel não traz proprietário, endereço, número nem CEP; `31/02` é recusado em vez de normalizado para março; imóvel de finalidade `ambos` entra nas buscas de venda e de locação; `valor_max` é comparado com `valor_aluguel` quando a finalidade é locação; um bairro contendo só curinga é recusado em vez de virar "traga a carteira inteira"; 13h entre duas janelas responde `fora_da_janela` e não `horario_ocupado`; o lead vai para `agendou` **pelo trigger**; cancelar libera o horário; cancelar duas vezes é idempotente; e o limite de requisições barrou na 118ª chamada do minuto, com mensagem dizendo em quantos segundos volta.

- **Etapa 8** — três funções de leitura da trilha de auditoria (migration `…016`). Nenhuma alteração de tabela.

  ### Por que a tela de Logs não consulta a tabela direto

  | Função | Para que serve |
  |---|---|
  | `fn_log_categoria(acao)` | Classifica a ação em `criacao`, `edicao`, `exclusao`, `status`, `sessao` ou `outro`, a partir do sufixo do nome |
  | `fn_logs_listar(busca, categoria, tabela, usuario, inicio, fim, limite, deslocamento)` | A página, o nome do usuário já resolvido e o **total real** da consulta |
  | `fn_logs_filtros()` | As tabelas, categorias e usuários que de fato aparecem em `logs_sistema` |

  **A busca precisa entrar no `jsonb`.** Quem digita "IMV-0042" está atrás de um imóvel que provavelmente não existe mais — a exclusão de imóvel é definitiva, e o código só sobrevive dentro de `dados_anteriores`. Uma consulta pelo PostgREST alcançaria `acao`, `tabela` e `id_registro`, que é justamente o conjunto de campos onde o código **não** está. Sem varrer o conteúdo, a única rastreabilidade que resta de uma exclusão fica inalcançável no exato caso em que ela é tudo o que sobrou.

  **A categoria precisa viver num lugar só.** Ela é derivada do sufixo, e é usada pelo filtro e pelo rótulo da linha. Se cada lado tivesse a própria cópia da regra, filtrar por "exclusão" traria uma lista que o rótulo de cada linha contradiz — e a divergência apareceria só quando alguém cadastrasse uma ação nova.

  A classificação sai do sufixo em vez de uma tabela de correspondência: ação nova que siga a convenção `entidade_acao` é classificada sozinha, em vez de cair calada fora de todos os filtros. `login_realizado` e `logout_realizado` têm categoria própria (`sessao`) porque, sem ela, caem em "outro" e viram a maioria da lista — todo dia de trabalho começa com um.

  **O total vem junto da página**, por `count(*) over ()`. Duas consultas separadas sobre os mesmos filtros saem de sincronia no dia em que alguém mudar um lado e esquecer do outro, e o resultado é uma paginação que oferece páginas vazias.

  ### Duas decisões de implementação

  **`strpos` em vez de `ilike`.** O termo vem digitado pelo usuário. Com `ilike`, um `%` ou `_` no meio de um código viraria curinga e a lista cresceria sem que ninguém entendesse por quê. Verificado: buscar `%` devolve zero linhas, não todas.

  **Varredura sequencial, assumida.** `dados_anteriores::text ilike` não usa índice. A alternativa — um GIN sobre o `jsonb` — custaria escrita em **toda ação registrada do sistema** para acelerar uma tela consultada esporadicamente e quase sempre já recortada por período. Se o volume um dia justificar, o lugar de mudar é esta função, e só ela.

  ### Privilégios

  Mesmo padrão da `…015`: **SECURITY INVOKER**, com o RLS de `logs_sistema` continuando a valer, e EXECUTE revogado de `public` e `anon`, concedido só a `authenticated`. Verificado: o anônimo recebe `42501` nas três.

  ### A trilha é imutável, e isso foi verificado

  `logs_sistema` tem política de `select` e de `insert` e **nenhuma de `update` ou `delete`**. A tela não oferece nenhuma ação de alteração, mas a garantia não depende disso: um `update` e um `delete` disparados pelo cliente autenticado afetaram **zero linhas**.

  É por causa disso que o **valor do token nunca entra no log**. `api_tokens.token` é guardado em texto e é recuperável pela tela — é assim que ele vai para a automação. Mas o que entra em `logs_sistema` não sai mais: registrar a linha crua gravaria o segredo em texto puro, de forma permanente, num lugar que qualquer usuário do painel lê e que uma revogação futura não teria como limpar. A função `semSegredo`, em `src/lib/tokens.ts`, substitui o valor pelo mascarado antes de qualquer gravação.

  ### Verificação

  **47 casos** pelo caminho real do cliente, mais **9** no Storage.

  Entre o confirmado: o anônimo não lê `api_tokens` nem `logs_sistema` e é barrado nas três funções novas; campo vazio de `configuracoes` vira `NULL` e não string vazia; uma segunda linha de `configuracoes` é recusada pelo índice de registro único; tipo com nome repetido é recusado com `23505` e tipo em uso com `23503`; a contagem de uso vem agregada do banco pelo embed `imoveis(count)`; a busca encontra o código **e o nome do proprietário** dentro do registro de um imóvel já excluído; `%` é tratado como texto; o total é o mesmo em todas as páginas e nenhuma linha se repete entre elas; `fn_logs_filtros` oferece `imoveis` e **não** oferece `corretores`, que nunca apareceu na trilha; e o log de token não contém o valor real.

  No Storage: o autenticado sobe PNG, SVG e WEBP no bucket `logos`, a imagem é servida publicamente (HTTP 200), o anônimo é barrado pelo RLS na escrita e o bucket recusa MIME fora da lista declarada na `…009`.

- **Etapa 6** — `configuracoes.foto_hero_url` adicionada (migration `…014`).

  **Por quê.** A vitrine abre com uma foto grande ocupando a primeira dobra, e ela não podia estar fixa no código: cada imobiliária tem a sua, e um caminho escrito no código transformaria "trocar a foto do site" em um deploy. A coluna é opcional — vazia, o site cai para a capa do imóvel em destaque e, se nem isso existir, para o fundo sólido na cor de destaque. Guarda a URL pública, no mesmo formato de `imoveis_fotos.url`, para que o site exiba a imagem sem nenhuma tradução no meio.

  ### O RLS protege linha, não coluna

  Este é o ponto de segurança da etapa, e vale registrar porque é contraintuitivo: a política `imoveis_anon_leitura_ativos` libera **a linha inteira** do imóvel ativo ao visitante anônimo — inclusive `proprietario_nome`, `proprietario_contato` e o endereço com número.

  Ou seja, o que impede o vazamento **não é o RLS**: é a lista explícita de colunas em `CAMPOS_CARD` e `CAMPOS_DETALHE`, em `src/lib/publico.ts`. Um `select('*')` na vitrine entregaria o telefone do proprietário a qualquer um que abrisse a aba de rede do navegador, sem nada aparecer na tela e sem nenhum erro em lugar nenhum.

  Verificado pelo caminho anônimo real, com um imóvel semeado com nome e telefone de proprietário e endereço completo: nenhum desses valores aparece no corpo da resposta, nem na listagem nem no detalhe.

  ### O filtro `status = 'ativo'` é aplicado duas vezes de propósito

  O RLS já restringe o papel `anon` a imóveis ativos — confirmado: buscar o código de um imóvel desativado sem nenhum filtro devolve nulo.

  Mesmo assim toda consulta da vitrine aplica `.eq('status','ativo')`. O motivo é o operador: ele abre o site pelo link "Ver site" **autenticado**, e para `authenticated` a política é `using (true)`. Sem o filtro explícito, ele veria na vitrine os imóveis que acabou de desativar e concluiria que a desativação não funciona.

  ### Verificação

  20 casos pelo caminho do visitante anônimo, sem sessão, todos passando: leitura de ativos, exclusão do desativado (com e sem filtro explícito), ausência total de dados de proprietário e de endereço nos dois formatos de consulta, fotos de imóvel inativo invisíveis, filtro de finalidade, leitura anônima de `configuracoes` e `tipos_imovel`, inserção de visualização e de clique, deduplicação por sessão nos três cenários, e a confirmação de que o anônimo **não lê** `visualizacoes_site` nem `crm_imobiliaria` de volta.

  Também foi verificado que o endpoint de transformação de imagem do Storage (`/render/image/public/...`) responde neste projeto, o que permitiu servir miniatura e cartão em larguras próprias em vez do arquivo de até 1920px. Como o recurso não existe em todo projeto Supabase, `FotoProgressiva` recarrega a URL original quando a transformada falha — sem essa rede, um projeto sem o recurso exibiria "Sem foto" na vitrine inteira.

- **Etapa 5** — nenhuma alteração de schema. Leads e Funil foram construídos sobre `crm_imobiliaria` como a Etapa 1 a definiu, inclusive o Realtime, que já estava publicado desde então.

  ### O que a exclusão de lead leva junto

  `agendamentos.id_lead` é `ON DELETE CASCADE` — ao contrário de `id_imovel`, que é `SET NULL`. Excluir um lead apaga **todas as visitas dele**, inclusive as futuras, que simplesmente desaparecem da agenda do corretor sem nenhum aviso do outro lado.

  A escolha faz sentido no banco: visita sem lead não é um fato do histórico, é um compromisso com ninguém. Mas é a consequência menos óbvia da tela, então o modal de exclusão conta as visitas antes e diz o número na confirmação. Verificado: excluído o lead, a visita ligada a ele não existe mais.

  ### Contagem da coluna do Kanban

  Cada coluna do Funil pagina, mas o cabeçalho precisa do total real da etapa — uma contagem que crescesse conforme o usuário rola seria pior do que nenhuma. A consulta usa `count: 'exact'` junto com `range`, o que traz a página e o total na mesma viagem. Confirmado pelo PostgREST: `range(0,1)` sobre três leads devolve duas linhas e `count = 3`.

  ### Verificação

  Nove casos em SQL direto e doze pelo caminho do cliente, todos passando.

  Em SQL: padrões do lead novo (`novo`/`lead`), `UNIQUE` de `whatsapp` recusando o segundo insert, constraint de status recusando valor fora das sete etapas, trigger 9 recalculando `minutos_ultima_mensagem`, trigger 7 promovendo a cliente **com o `RETURNING` ainda dizendo `lead`**, trigger 8 movendo o lead para `agendou` e limpando `data_agendamento` no cancelamento da última visita, `CASCADE` levando a visita junto do lead e o upsert por `whatsapp` devolvendo o mesmo id.

  Pelo cliente autenticado: RLS de leitura e escrita, as três formas de busca do `.or()` (nome, WhatsApp e código do imóvel), ordenação com `nullsFirst: false` jogando os sem-nome para o fim, `count` com `range` nas duas páginas, filtro de período cobrindo o dia inteiro, `23505` chegando ao cliente, gravação em `logs_sistema` e entrega de Realtime em `crm_imobiliaria` — com o payload trazendo o **status anterior**, graças ao `replica identity full`, que é como o Funil sabe qual coluna de origem recarregar.

  Uma nota sobre o teste de Realtime: a primeira rodada acusou falha, e era o teste que estava errado. O canal informa `SUBSCRIBED` antes de a assinatura estar de fato ligada ao fluxo de replicação, e 600 ms de espera não bastavam. Com espera maior, a entrega é consistente. Não é problema do sistema — na aplicação real a sessão já está estabelecida muito antes de o usuário abrir o Funil —, mas é armadilha para o próximo teste automatizado que mexer com Realtime.

- **Etapa 3** — nenhuma alteração de schema. A tela de Imóveis foi construída inteiramente sobre o schema da Etapa 1; as regras que ela precisa — código automático, limite de fotos, capa única, valor obrigatório por finalidade, `RESTRICT` no tipo — já estavam no banco.

  Verificada contra o banco real em 19 casos, incluindo a ordem de sincronização das fotos contra o índice único de capa, o trigger de limite disparando na 11ª foto, e a exclusão definitiva preservando `codigo_imovel` no agendamento e o registro completo em `logs_sistema`.
