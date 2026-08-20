# ImobFlow

Sistema de gestão para imobiliárias que trabalham simultaneamente com **venda e locação** de imóveis.

---

## 1. O que é o ImobFlow

O ImobFlow resolve o problema de imobiliária que mantém dois mundos separados: um site que alguém precisa atualizar à mão e uma planilha onde a carteira de imóveis realmente vive. Aqui é uma base só. O corretor cadastra o imóvel no painel e ele aparece na vitrine no mesmo instante; desativa e ele sai. Não existe publicação manual, não existe versão do site diferente da versão do sistema.

O sistema é composto por duas partes que operam sobre o mesmo banco de dados: um **site público**, que funciona como vitrine de imóveis com filtros e página individual por imóvel, e um **painel interno**, onde a imobiliária gerencia carteira, corretores, agenda de visitas e funil de leads.

A terceira peça é um **agente de IA no WhatsApp**, integrado ao Chatwoot. Ele atende o contato que chega pelo botão do site, identifica o imóvel pelo código, busca imóveis por características, consulta a disponibilidade dos corretores e agenda, reagenda ou cancela visitas — tudo através de uma API pública autenticada por token, sobre a mesma base. O lead criado pelo agente aparece no Kanban do painel em tempo real, sem ninguém recarregar a página.

---

## 2. As duas partes do sistema

### Site público — a vitrine

- Home com busca na primeira dobra, 24 imóveis com seletor de categorias, como funciona, perguntas frequentes e a seção "Sobre a imobiliária" com mapa
- Listagem com filtros por finalidade (comprar ou alugar), tipo, cidade, bairro, faixa de preço, quartos, banheiros e vagas — todos refletidos na URL, então a busca pode ser compartilhada
- Página individual do imóvel, com galeria de fotos, características, diferenciais e valores
- **Botão de WhatsApp com o código do imóvel** já na mensagem: o contato chega ao agente de IA já dizendo qual imóvel gerou o interesse
- Rastreamento próprio de visualizações e cliques, sem depender de ferramenta externa e sem coletar dado pessoal
- Mostra apenas imóveis com `status = ativo`, restrição garantida no banco e não apenas no código
- **Nunca expõe dados do proprietário nem o endereço exato do imóvel** — essas colunas sequer são buscadas

#### O caminho do visitante até o WhatsApp

É para este percurso que o site existe, e ele tem quatro passos:

1. O visitante chega — quase sempre pelo celular, por um link compartilhado — e filtra por finalidade, bairro e valor. O filtro vai para a URL, então ele manda a busca para quem decide junto com ele.
2. Abre a página de um imóvel. A rota é `/imovel/IMV-0042`, pelo **código**, porque é o código que circula no WhatsApp e que a equipe usa para falar do imóvel.
3. Toca no botão de WhatsApp, fixo na base da tela no celular. A mensagem já vai escrita: *"Olá! Tenho interesse no imóvel IMV-0042."*
4. O agente de IA recebe a mensagem **já sabendo qual imóvel é** e responde sobre ele na primeira resposta — sem a pergunta "qual imóvel você viu?", que é onde o contato costuma esfriar. O lead aparece no Kanban do painel em tempo real.

O clique é registrado em `visualizacoes_site` **sem segurar a navegação**: se a gravação falhar, o WhatsApp abre assim mesmo. Perder a medição é aceitável; perder o lead não.

> **Prévia do link no WhatsApp.** A página do imóvel monta as tags Open Graph em tempo de execução, o que serve ao navegador mas **não à prévia com foto no WhatsApp**: o robô de prévia não executa JavaScript e lê o HTML cru, que numa SPA vem vazio. Resolver isso é tarefa de publicação — pré-renderização no build ou uma função de borda que responda ao robô — e está previsto para a Etapa 11.

### Painel interno — a gestão

- **Imóveis** — cadastro, edição, galeria de até 10 fotos, ativação e desativação
- **Corretores** — cadastro da equipe, com cor de destaque na agenda
- **Agenda** — visitas em blocos de 30 minutos, com janela de atendimento própria por corretor
- **Leads e CRM** — lista de leads e Kanban do funil, alimentados também pelo agente de IA
- **Dashboard** — imóveis mais vistos, cliques no WhatsApp, visitas e conversão
- **Configurações** — dados da imobiliária que alimentam site e API ao mesmo tempo

---

## 3. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript |
| Estilização | Tailwind CSS + Shadcn/UI |
| Roteamento | React Router |
| Banco de dados | Supabase — Postgres 17 |
| Autenticação | Supabase Auth |
| Arquivos | Supabase Storage |
| API pública | Supabase Edge Functions |
| Tempo real | Supabase Realtime |

---

## 4. Como rodar localmente

### Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Uma conta no Supabase com o projeto provisionado e as migrations aplicadas
- O Supabase CLI, que roda por `npx supabase …` sem precisar instalar nada

### Instalação

```bash
npm install
cp .env.example .env    # e preencha as duas variáveis
npm run dev
```

A aplicação sobe em `http://localhost:5173`. Se a porta estiver ocupada, o Vite escolhe a próxima livre e imprime o endereço real no terminal.

**Isso sobe o painel e a vitrine, e só.** Os dois falam direto com o banco, então funcionam sem mais nada. A API que o agente de IA consome é uma Edge Function que roda **dentro do projeto Supabase** e precisa ser publicada à parte, num passo próprio: ver "Publicando a Edge Function da API", logo abaixo.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run typecheck` | Só a checagem de tipos |

### Regerando os tipos do banco

`src/tipos/banco.ts` é **gerado a partir do schema**, não escrito à mão. Depois de qualquer alteração no banco:

```bash
npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/tipos/banco.ts
```

### Criando o primeiro usuário do painel

Não existe tela de cadastro. **Usuários são criados exclusivamente pelo desenvolvedor**, no painel do Supabase.

1. Acesse **Authentication > Users** no painel do Supabase
2. Clique em **Add user**, informe email e senha
3. Pronto — um trigger em `auth.users` cria automaticamente o registro correspondente em `public.usuarios`

Para conferir, ou para corrigir o nome exibido no painel:

```sql
select id, nome, email from public.usuarios;
update public.usuarios set nome = 'Nome Completo' where email = 'usuario@exemplo.com';
```

Se por algum motivo o registro não tiver sido criado, insira à mão usando **o mesmo `id`** gerado pelo Auth:

```sql
insert into public.usuarios (id, nome, email)
values ('<uuid-copiado-de-authentication-users>', 'Nome Completo', 'usuario@exemplo.com');
```

### Aplicando o banco em um projeto novo

As migrations estão em [supabase/migrations/](supabase/migrations/) e devem ser aplicadas **em ordem numérica**, via Supabase CLI (`supabase db push`) ou coladas no SQL Editor uma a uma.

Elas criam as duas extensões de que o sistema precisa, `pgcrypto` e `pg_cron`. Não há passo manual em projeto Supabase.

**Terminando, confira que o job de relógio ficou de pé:**

```sql
select jobname, schedule, active from cron.job;
-- esperado: minutos_ultima_mensagem | * * * * * | t
```

Essa conferência não é zelo. É o único ponto da instalação que **falha sem dar erro**. O job mantém `crm_imobiliaria.minutos_ultima_mensagem` no valor real, e sem ele o painel funciona, a vitrine publica e a API responde exatamente como deveriam; o que quebra é a régua de follow-up do agente de IA, que passa a ler um número congelado no instante da última mensagem, dentro de uma conversa que ninguém no painel está acompanhando. BANCO.md, seção 4.1, explica o job; a seção 8 traz o diagnóstico quando a lista sai vazia.

### Publicando a Edge Function da API

**Este passo é obrigatório, não acontece sozinho e é o que mais some do roteiro.** O painel e a vitrine falam direto com o banco, então sobem sem ele. A API que o agente de IA consome é código que precisa rodar dentro do projeto Supabase, e mandar esse código para lá é um comando à parte: nem `npm run dev`, nem `git push`, nem o deploy do frontend na Vercel publicam a função.

```bash
npx supabase login
npx supabase functions deploy api --project-ref SEU_PROJECT_REF
```

Não é preciso rodar `supabase link`: com `--project-ref` o comando já sabe o destino, e você pula a etapa que pede a senha do banco. Também não é preciso passar `--no-verify-jwt`, porque `verify_jwt = false` já está declarado em [supabase/config.toml](supabase/config.toml).

**Confira que subiu**, sem token, esperando a recusa de autenticação:

```bash
curl -X POST "https://SEU-PROJETO.supabase.co/functions/v1/api/imoveis/buscar" \
  -H "Content-Type: application/json" -d '{}'
```

| Resposta | O que significa |
|---|---|
| `{"code":"NOT_FOUND","message":"Requested function was not found"}` | A função não está publicada nesse projeto. É o estado de quem pulou este passo |
| `{"sucesso":false,"erro":"nao_autorizado", …}` | Publicada e respondendo. É o resultado esperado, e o cabeçalho `Authorization` que falta ali é justamente o que o agente já manda |

**A conferência não é zelo, é a única forma de perceber.** Sem a função, nada dá erro: o painel abre, a vitrine publica, os imóveis aparecem e o site pode até ser divulgado. O que não funciona é o agente de IA, e a falha só se manifesta dentro do N8N, num lugar onde a suspeita natural recai sobre o fluxo, que está certo. É a mesma classe de armadilha do job de relógio, logo acima.

**Nenhum secret precisa ser configurado para isto funcionar.** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase em toda Edge Function publicada. As variáveis da seção 5 têm padrão e só existem para mudar o padrão.

**Republique sempre que mexer em qualquer arquivo de [supabase/functions/](supabase/functions/).** Editar o código aqui não muda nada no ar até o deploy rodar de novo.

### A migration 025 é o estoque de demonstração, e não deve sobreviver à divulgação

Uma migration insere **estoque fictício**, para que o painel, a vitrine, o Dashboard e a API possam ser vistos com dados, em vez de com telas vazias:

| Migration | O que insere |
|---|---|
| [025](supabase/migrations/20260819000025_seed_imoveis_sp_zona_sul_oeste.sql) | 30 imóveis em São Paulo, zonas sul e oeste, mais o interior: 15 apartamentos para locação, 10 para venda e 5 casas para venda |

Diferente de todas as outras, ela é **conteúdo, não estrutura**. Endereços, proprietários e telefones são inventados, e as fotos são de banco de imagens e se repetem entre os anúncios.

A composição não é aleatória, e é o que faz o sistema poder ser avaliado de verdade: **duas finalidades e mais de um tipo de imóvel.** Com estoque de uma finalidade só, o primeiro nível de navegação da vitrine devolve sempre a lista inteira; com um tipo só, o mesmo acontece com o filtro de tipo. Nos dois casos um filtro quebrado passaria despercebido, porque a tela cheia parece uma tela certa.

> ⚠️ Não aplique numa instalação já divulgada ao público. Não existe publicação manual no ImobFlow: salvar é publicar, e o visitante não tem como saber que aquele anúncio é de demonstração.

Para remover tudo depois, uma linha, com as fotos saindo em cascata:

```sql
delete from public.imoveis
 where id::text like 'a5e30000-%';   -- os 30 imóveis da 025
```

---

## 5. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. **Nunca versione o `.env`.**

### Públicas — expostas ao navegador

Tudo com prefixo `VITE_` é embutido no bundle e fica visível para qualquer visitante. Só coloque aqui o que pode ser público. São **duas variáveis**, ambas obrigatórias:

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase. Ex: `https://SEU-PROJETO.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave anônima. Pode ser pública porque quem protege os dados é o RLS, não o segredo da chave |

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANONIMA_AQUI
```

O arquivo `.env.example` na raiz é o modelo. O `.env` está no `.gitignore` e nunca deve ser versionado.

### Privadas — nunca vão para o frontend

**Não existem no `.env` do projeto.** Qualquer variável lida pelo Vite com prefixo `VITE_` vaza para o navegador; sem o prefixo, o Vite simplesmente não a entrega ao código do cliente. Estas vivem apenas nos secrets das Edge Functions:

| Variável | Para que serve |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Injetadas automaticamente pelo Supabase nas Edge Functions. A chave de serviço **ignora todo o RLS** |
| `ANTECEDENCIA_MINIMA_MINUTOS` | Antecedência mínima para a API oferecer um horário. Padrão 60 |
| `LIMITE_REQUISICOES_MINUTO` | Teto de chamadas por token, por minuto. Padrão 120 |
| `LIMITE_BUSCA_PADRAO`, `LIMITE_BUSCA_MAXIMO` | Tamanho da página da busca de imóveis. Padrão 5 e 20 |
| `CHATWOOT_API_TOKEN`, `CHATWOOT_BASE_URL` | Reservados para uma futura integração com a API do Chatwoot. **Nenhum código lê estes dois hoje**, então não há o que configurar ainda. O painel não exibe nada do Chatwoot |

```bash
supabase secrets set ANTECEDENCIA_MINIMA_MINUTOS=60 LIMITE_REQUISICOES_MINUTO=120
```

O token do agente de IA **não** é variável de ambiente: ele é gerado no painel, em Configurações → API, e validado contra a tabela `api_tokens`. Um token por consumidor, revogável sem deploy.

Se alguma dessas chaves aparecer no bundle, considere-a comprometida e gere outra.

---

## 5b. A API pública

O agente de IA no WhatsApp conversa com o sistema por uma **Supabase Edge Function**:

```
https://<seu-projeto>.supabase.co/functions/v1/api
```

Todo endpoint exige o cabeçalho:

```
Authorization: Bearer SEU_TOKEN_AQUI
```

### Como obter um token

No painel, **Configurações → API → Novo token**. Dê um nome que identifique o consumidor ("Agente WhatsApp", "Integração portal") e **copie o valor no momento da criação** — é ali que ele precisa ir para a automação. Um token por consumidor: é o que permite revogar o do portal sem derrubar o agente junto, e saber pelos logs qual dos dois fez o quê.

A revogação vale na chamada seguinte, sem período de tolerância.

### Os endpoints

| Método | Caminho | Para que serve |
|---|---|---|
| `POST` | `/imoveis/buscar` | **O endpoint de imóveis.** Com `codigos` no corpo, ficha completa por código. Sem eles, filtros combináveis com alternativas quando nada corresponde |
| `GET` | `/imoveis/ativos` | Carteira disponível, paginada |
| `GET` | `/imoveis/inativos` | Fora do anúncio. Uso interno |
| `POST` | `/agenda/disponibilidade` | Horários livres, com ou sem hora específica |
| `POST` | `/agenda/agendar` | Marca a visita |
| `POST` | `/agenda/reagendar` | Move a visita, por id |
| `POST` | `/agenda/cancelar` | Cancela, por id |
| `GET` | `/agenda/visitas` | Lista com o id de cada visita |
| `GET` | `/corretores` | Equipe ativa, com o id do corretor e o da agenda dele |
| `GET` | `/leads/:whatsapp` | Lead e histórico. Somente leitura |

Os **dados da imobiliária** (endereço, contatos, redes e horário de atendimento) não estão na API: o agente lê a view `info_imob_agente` direto no Supabase, com `select informacoes from info_imob_agente`, e recebe tudo em uma frase pronta. Ver BANCO.md, seção 2.14.

**A documentação completa fica dentro do próprio painel**, em Configurações → API: cada endpoint com parâmetros, resposta de exemplo e um `curl` pronto para colar no N8N, já com a URL desta instalação e o token escolhido preenchido.

### O status HTTP diz se a requisição funcionou, não se deu certo

Isto muda como o fluxo do N8N é montado, então precisa estar aqui e não só no painel.

**Recusa de negócio sai em `200` com `sucesso: false`**: horário ocupado, fora da janela, imóvel inexistente, parâmetro faltando. A requisição foi bem formada, autenticada e processada, e a resposta certa para ela é "não". Só falha de verdade sai com status de erro, e são cinco: token ausente e token inválido (401), limite excedido (429), rota inexistente (404) e falha interna (500).

O motivo é o consumidor real: o nó HTTP do N8N trata status fora do 2xx como exceção, **descarta o corpo** e entrega no lugar um `error.message` montado por ele, no formato `400 - "{\"sucesso\":false,…}"`. A frase que o agente ia repassar ao cliente continua lá, escapada dentro de uma string, e o fluxo passa a ter que desembrulhar JSON de dentro de texto.

> **No fluxo, ramifique por `sucesso` e `erro`, nunca pelo ramo de erro do nó.** Recusas chegam no Success Branch. O campo `erro` é o código curto e estável para o switch; a `mensagem` é a frase em português para o cliente.

`/agenda/agendar` e `/agenda/reagendar` devolvem também **`data_hora`**, em ISO 8601 com o fuso da imobiliária (`2026-08-24T15:00:00-03:00`), para o fluxo criar ou mover o evento no calendário sem extrair data de dentro da frase.

### Um endpoint só para imóveis

`POST /imoveis/buscar` atende os dois caminhos do atendimento:

```jsonc
{ "codigos": "IMV-0001, IMV-0007" }          // ficha completa, teto de 5
{ "cidade": "São Paulo", "quartos_min": 3 }  // resumo, paginado, com total
```

É a mesma pergunta do cliente nos dois casos, e a diferença é só por onde ele chegou: com o código do link do site, ou descrevendo o que quer. Deixar essa escolha de rota a cargo do agente era decisão que ele podia errar sem que ninguém notasse, porque o sintoma não é um erro, é uma resposta pior.

> **Duas rotas herdadas continuam respondendo:** `GET /imoveis/codigo/:codigo` e `POST /imoveis/codigos`. Elas saíram do catálogo e do índice, mas seguem no ar para que o fluxo do N8N em produção não quebre no deploy da fusão. **Aponte o fluxo para `/imoveis/buscar` e avise, que elas saem do código.**

### Toda ficha de imóvel traz o código e o link da página

Os cinco endpoints de imóvel devolvem, em cada item, `codigo` e `url`, e os dois vão também dentro da `mensagem` que o agente repassa ao cliente. O código amarra o atendimento ao imóvel; a URL é o que o cliente abre para ver as fotos, e vem montada pela API justamente para que o modelo nunca precise inventar um endereço.

**Preencha o endereço do site em Configurações → Dados.** É de lá que a URL é montada. Enquanto o campo estiver vazio, `url` vem `null` em toda ficha e o agente atende normalmente, só nunca manda link. Não gera erro em lugar nenhum, o que torna fácil esquecer no dia da publicação.

Imóvel fora do anúncio também vem com `url` nula: a vitrine só publica ativos, e o endereço de um desativado cairia na página de imóvel não encontrado.

> A ressalva da prévia vale aqui: o link abre normalmente ao ser tocado, mas a miniatura com foto no WhatsApp depende da pré-renderização prevista para a Etapa 11.

### Uma decisão de arquitetura que precisa ser conhecida

**A API não expõe escrita em leads.** Criar, atualizar e mudar o status do lead é o agente escrevendo **direto nas tabelas** pelo N8N. A única exceção é o upsert por WhatsApp dentro de `/agenda/agendar`.

Isso é consciente, e tem consequências:

- O agente opera com a **service role key**, que ignora todo o RLS. Essa credencial vive fora do backend, dentro do fluxo N8N, com acesso irrestrito ao banco
- Ela nunca pode aparecer em log, em captura de tela de fluxo ou em repositório
- **Escritas diretas não passam por `logs_sistema`.** As operações via API passam. A rastreabilidade das escritas diretas depende do histórico do próprio N8N
- Qualquer erro no fluxo tem potencial de afetar qualquer tabela, não só as de lead
- Restrinja o fluxo do agente a escrever apenas em `crm_imobiliaria` — **por disciplina de construção**, já que a credencial não impõe isso tecnicamente

### Publicando a função

```bash
npx supabase functions deploy api --project-ref <ref>
```

O roteiro completo, com a conferência de que a função subiu, está na seção 4, em "Publicando a Edge Function da API". **Sem esse comando não existe API**, por mais que o código esteja no repositório.

A flag `--no-verify-jwt` não é mais necessária, porque `verify_jwt = false` já está em [supabase/config.toml](supabase/config.toml). O motivo de ele estar desligado permanece: o `Authorization` desta função carrega o token do ImobFlow, não um JWT do Supabase Auth. Com a verificação ligada, o gateway rejeitaria toda requisição antes de o código rodar. A tranca passa a ser a validação de token, que é a primeira coisa executada em qualquer requisição.

---

## 6. Colocando no ar

Até aqui o sistema roda na sua máquina. Este capítulo é o que falta para ele existir na internet, com endereço que o cliente acessa e API que o agente de IA alcança.

São **duas publicações independentes**, e é importante saber disso antes de começar, porque uma não faz a outra:

| O quê | Onde | O que quebra se faltar |
|---|---|---|
| Banco e Edge Function | Supabase | Sem o banco, nada funciona. Sem a função, só o agente de IA para de funcionar, **e sem dar erro** |
| Site e painel | Vercel | O sistema fica preso no seu `localhost` |

### 6.1 O que ter em mãos

- **Conta no Supabase e conta na Vercel.** Os planos gratuitos dão conta de uma imobiliária
- **O repositório no GitHub.** A Vercel publica a partir dele
- **Um access token do Supabase**, gerado em [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)

**Sobre o token, duas coisas que precisam ser ditas juntas.** Ele tem prazo de expiração, que você escolhe na criação, e é isso que torna aceitável usá-lo aqui. Mas ele **vale para a conta inteira, não para um projeto**: não existe token com escopo limitado no Supabase, e enquanto estiver válido ele alcança todos os projetos da conta, com os mesmos poderes que você tem. Gere um com prazo curto, use, e **revogue na mesma página ao terminar**.

**Se for usar o Claude Code para publicar, crie antes o arquivo `.claude/settings.json`** na raiz do projeto:

```json
{
  "permissions": {
    "allow": ["Bash(npx supabase:*)"]
  }
}
```

Sem ele o agente é barrado ao publicar, e a mensagem de bloqueio não deixa claro que o problema é de permissão e não do Supabase. O prejuízo é meia hora procurando defeito no lugar errado.

### 6.2 O Supabase, conduzido pela IA

Cole o texto abaixo no chat do Claude Code, ou do agente que você usar. Ele foi escrito para a IA **perguntar o que falta e esperar**, em vez de supor:

```
Vamos publicar o ImobFlow no Supabase. Antes de rodar qualquer comando, me pergunte
e espere a minha resposta:

1. o nome do projeto a criar
2. o meu access token do Supabase
3. a região (sa-east-1 para clientes no Brasil)

Com isso em mãos, faça na ordem, conferindo cada passo antes de seguir para o próximo:

- criar o projeto no Supabase
- aplicar todas as migrations de supabase/migrations, em ordem numérica
- publicar a Edge Function api
- testar POST /functions/v1/api/imoveis/buscar sem token, e confirmar que a
  resposta é nao_autorizado e não NOT_FOUND
- conferir o job de relógio com: select jobname, active from cron.job
- me devolver a URL do projeto e a chave anônima, que eu preciso para o .env
  e para a Vercel

Se algum passo falhar, pare e me mostre o erro em vez de seguir adiante.
```

São estes os comandos que a IA vai executar. Estão aqui para você acompanhar, e para poder rodar à mão se preferir:

```bash
npx supabase projects create "NOME" --org-id <org> --db-password "SENHA" --region sa-east-1
npx supabase db push --project-ref <ref> --password "SENHA"
npx supabase functions deploy api --project-ref <ref>
```

**O estoque de demonstração vem junto, e isso é de propósito.** A migration 025 insere 30 imóveis fictícios, e roda como todas as outras: o `db push` aplica a pasta inteira, em ordem, e não existe forma de pular um arquivo. Um painel recém-instalado sem nenhum imóvel não deixa ver o Dashboard, os filtros da vitrine nem a busca da API funcionando, e é justamente na primeira meia hora que alguém quer olhar isso. Eles saem numa linha quando a carteira real entrar, e a seção 6.4 traz o comando.

**Guarde a senha do banco que for escolhida na criação.** Ela não é recuperável depois, só redefinível, e o `db push` precisa dela.

Quem preferir não usar IA nem CLI tem o caminho manual já descrito na seção 4: criar o projeto pelo painel do Supabase e colar as migrations no SQL Editor, uma a uma, em ordem. **O que não tem caminho pelo painel é a Edge Function** — ela sai de "Publicando a Edge Function da API", também na seção 4.

### 6.3 A Vercel

1. **Suba o projeto para o GitHub**, se ainda não estiver lá
2. Na Vercel, **Add New → Project**, e importe o repositório
3. O framework é detectado como Vite. Build `npm run build`, saída `dist`. Não há o que ajustar
4. **Em Environment Variables, cadastre as duas** da seção 5: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, com os valores que a IA devolveu no passo anterior. **Elas não vêm do `.env`**, que está no `.gitignore` e não sobe para o GitHub
5. **Deploy**

O [vercel.json](vercel.json) já está no repositório e não precisa de ajuste. Ele reescreve toda rota para o `index.html`, que é o que impede um link direto de imóvel, mandado por WhatsApp, de cair em 404 ao ser aberto do zero.

### 6.4 Depois que estiver no ar, três coisas

**Preencha o endereço do site** em Configurações → Dados, com o domínio da Vercel. Enquanto `configuracoes.url_site` estiver vazia, a API devolve `url` nula em toda ficha de imóvel e o agente atende sem nunca mandar o link das fotos. Não dá erro em lugar nenhum, que é o que torna fácil esquecer.

**Revogue o access token** em [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). Ele já cumpriu o papel, e continuar válido só aumenta a superfície.

**Apague o estoque de demonstração** antes de divulgar o endereço. Os 30 imóveis da migration 025 já estão na vitrine, com endereços inventados e fotos de banco de imagens que se repetem entre os anúncios, e o visitante não tem como saber que são de mentira:

```sql
delete from public.imoveis
 where id::text like 'a5e30000-%';   -- os 30 imóveis da 025
```

### 6.5 O que continua em aberto depois do deploy

A **prévia do link no WhatsApp** sai sem foto e sem título. O ImobFlow é uma SPA: o HTML servido é uma casca vazia e as tags Open Graph só existem depois que o React monta, enquanto o robô de prévia lê o HTML cru e vai embora. Fechar isso é decisão de publicação, e são duas saídas: pré-renderização no build, ou uma função de borda que responda ao user-agent do robô com o HTML já preenchido. **O link funciona ao ser tocado** — o que falta é só a miniatura.

---

## 7. Índice da documentação

| Documento | Quando abrir |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Antes de mexer em qualquer coisa. Contexto do projeto, stack, regras de negócio críticas e histórico de construção |
| [BANCO.md](BANCO.md) | Ao mexer em dados, escrever query, criar trigger ou entender por que o schema é do jeito que é |
| [NICHO.md](NICHO.md) | Ao colocar o sistema no ar para **outra imobiliária** |
| [REPLICACAO.md](REPLICACAO.md) | Ao reaproveitar a arquitetura para **outro nicho de negócio** — concessionária, clínica, escola |

---

## 8. Status do projeto

| Etapa | Escopo | Situação |
|---|---|---|
| 1 | Banco de dados e documentação | **Concluída** |
| 2 | Estrutura, navegação e login | **Concluída** |
| 3 | Imóveis | **Concluída** |
| 4 | Corretores e Agenda | **Concluída** |
| 5 | Leads e Funil | **Concluída** |
| 6 | Site público | **Concluída** |
| 7 | Dashboard | **Concluída** |
| 8 | Configurações | **Concluída** |
| 9 | API pública | **Concluída** |
| 10 | Auditoria de segurança | Pendente |
| 11 | Deploy | **Roteirizada** na seção 6, "Colocando no ar". Cada instalação a executa uma vez |

### O que a Etapa 9 entregou

- **API pública** em Supabase Edge Function, com os endpoints de atendimento autenticados por token
- Mensagens em **português conversacional**, prontas para o agente repassar ao cliente no WhatsApp — e não texto técnico
- Horários alternativos escritos **dentro da própria mensagem**, para o agente não precisar formatar data
- Cálculo de disponibilidade consolidando todos os corretores ativos, respeitando a janela individual de cada um
- Busca que devolve **alternativas** quando nada corresponde, em vez de lista vazia — lista vazia encerra o atendimento
- Limite de requisições por token, com contador no banco (Edge Function é efêmera; contador em memória não limita nada)
- Toda chamada registrada em `logs_sistema` com o consumidor identificado
- Documentação completa dentro do painel, com `curl` pronto para o N8N

### O que a Etapa 8 entregou

- Configurações em quatro abas — **Dados da imobiliária**, **Tipos de imóvel**, **API** e **Logs** —, todas com endereço próprio na URL
- Os dados da imobiliária alimentam painel, site público e API ao mesmo tempo, e **cada seção do formulário diz para onde os dela vão**
- Logo e foto de fundo do site enviadas pelo painel; nome, endereço, contato, redes, mapa, horário de atendimento e fuso horário sem tocar em código
- Horário de atendimento por dia da semana, com a frase que o agente vai falar exibida antes de salvar. Ele **não** define os horários de visita, que continuam vindo da agenda de cada corretor: a tela avisa quando o horário declarado é maior do que a equipe consegue cobrir
- Bloco no topo listando o que ainda falta para publicar o site — e que some quando não falta mais nada
- Tipos de imóvel com contagem de uso, ordem definida por arrastar (a mesma dos filtros do site) e recusa explicada quando o tipo está em uso
- Tokens da API prontos antes da Etapa 9: um por consumidor, com revogação que vale na chamada seguinte
- Logs em linguagem natural — "Excluiu o imóvel IMV-0042", não "delete imoveis" — com busca que encontra o imóvel **depois** de ele ter sido excluído
- A trilha é somente leitura na tela e no banco: `logs_sistema` não tem política de update nem de delete

### O que a Etapa 7 entregou

- Dashboard como página inicial do painel, com seletor de período valendo para tudo
- Quatro indicadores fixos no topo — leads, visitas, tráfego do site e imóveis ativos — cada um com a variação contra o período anterior
- Aba **Site**: quais imóveis são mais vistos, quais geram mais clique no WhatsApp e a **taxa de conversão de cada um** — o número que separa "muito visto e pouco clicado" (problema de preço ou foto) de "pouco visto e muito clicado" (merece destaque)
- Aba **Operação**: leads, atendimentos do agente e visitas por dia, concentração por dia da semana e a situação atual do funil
- Todos os números vêm do banco do próprio sistema, agregados no Postgres — sem ferramenta externa de análise e sem somar nada no navegador
- Sistema recém-implantado vê uma tela de primeiros passos, não uma página de zeros

### O que a Etapa 6 entregou

- Vitrine pública completa, sem login em nenhum ponto: home, listagem e página do imóvel
- Busca já na primeira dobra da home, com finalidade, tipo, local, valor e quartos
- Filtros da listagem refletidos na URL — o link de uma busca filtrada abre igual do outro lado
- Página do imóvel acessada pelo **código** (`/imovel/IMV-0042`), com galeria em tela cheia
- Botão de WhatsApp com o código já na mensagem, fixo na base da tela no celular
- Faixa de números da home puxando **dados reais** do banco, nunca conteúdo fictício
- Cabeçalho e rodapé montados a partir das Configurações, com todo campo condicional: o que não estiver preenchido não é renderizado
- Rastreamento próprio de visualizações e cliques, com sessão anônima e sem contar acessos da equipe
- Fotos redimensionadas pelo Storage conforme o contexto, com queda para a original se o recurso não existir

### O que a Etapa 5 entregou

- **Leads** em tabela, com colunas ordenáveis e filtros combináveis — busca livre, etapa (seleção múltipla), origem, lead ou cliente, interesse e período de entrada
- **Funil** em Kanban com as sete etapas, arrastando o card para mudar a etapa
- As duas telas são a mesma tabela, e o botão de alternância **leva os filtros junto** — o recorte não se perde ao trocar de visualização
- Ficha do lead em painel lateral, a mesma nas duas telas: identificação, interesse, atendimento do agente de IA, histórico de visitas, observações e troca de etapa
- Cadastro manual em modal curto, com o WhatsApp como único campo obrigatório. Número repetido não vira erro: o sistema avisa que o contato já existe e abre o cadastro dele
- Campo de WhatsApp com seletor de país, Brasil escolhido por padrão, e trava de dígitos pela regra de cada país. Grava sempre com o código do país, no mesmo formato que o agente de IA usa
- Cada coluna do Kanban carrega os cards aos poucos, mas o cabeçalho sempre mostra o total real da etapa
- Tempo real: o card se move sozinho, com destaque, quando o agente de IA muda o status do lead

### O que a Etapa 4 entregou

- Cadastro de corretores com paleta fechada de cores, que impede dois corretores com a mesma cor na agenda
- Janela de atendimento editável por dia da semana, com replicação de horário entre dias
- Agenda com três visões: semana (padrão), dia com uma coluna por corretor, e mês como panorama
- Criação de visita clicando num horário livre, com busca de lead e imóvel e cadastro rápido de lead sem sair do fluxo
- Disponibilidade de cada corretor sinalizada antes de salvar, antecipando o que o banco vai responder
- Arrastar para reagendar — e, na visão de dia, para trocar o corretor responsável
- Realtime: visita criada pelo agente de IA aparece na agenda com destaque, sem recarregar
- Detalhe da visita dizendo quem marcou (painel, agente de IA ou API) e, quando foi o agente, o resumo da conversa que levou ao agendamento

### O que a Etapa 3 entregou

- Listagem de imóveis em grade de cards, com alternador para lista compacta
- Filtros combináveis — busca livre, finalidade, tipo, status, cidade, bairro, faixa de valor, quartos e vagas — todos refletidos na URL, então um link de busca filtrada pode ser copiado e compartilhado
- Cadastro e edição em página própria, com seis seções, busca de endereço por CEP e aviso ao sair com alterações não salvas
- Galeria de até 10 fotos com arrastar e soltar, compressão no navegador antes do upload, reordenação e definição de capa
- Desativar (reversível) e excluir (definitivo) como fluxos visualmente distintos, o segundo exigindo digitar o código do imóvel

### O que a Etapa 2 entregou

- Projeto React + Vite + TypeScript com Tailwind e primitivos no estilo Shadcn
- Sistema de design centralizado em `src/index.css`, com a cor de destaque como ponto único de troca
- Login em `/login`, com sessão persistente e redirecionamento de quem já está autenticado. Nome e logo vêm das Configurações, e a coluna visual apresenta as quatro áreas do painel
- Rotas protegidas sob `/painel`, com estado de carregamento na verificação inicial da sessão
- Layout do painel: sidebar escura em verde profundo, agrupada, recolhível e responsiva, header com menu do usuário
- As 11 rotas registradas, com placeholders navegáveis e duas páginas 404, uma por área
- Contexto de configurações com Realtime no painel e leitura anônima na vitrine
- Componentes globais, `registrarLog`, favicon próprio e título de aba dinâmico

### O que a Etapa 1 entregou

- 13 tabelas com RLS ativo, chaves estrangeiras com política de exclusão explícita e índices alinhados aos filtros reais do sistema
- 11 regras de integridade: 10 triggers e 1 constraint declarativa
- 1 trigger extra em `auth.users`, que dispensa o passo manual de criar o usuário do painel à mão
- Realtime em `crm_imobiliaria` e `agendamentos`
- Buckets `logos` e `imoveis` no Storage, com tipos de arquivo restritos
- Seed de `configuracoes` e dos 11 tipos de imóvel
- Os cinco documentos do projeto
