# ImobFlow

## Visão geral do projeto

ImobFlow, sistema de gestão para imobiliárias que trabalham com venda e locação. Composto por um site público que funciona como vitrine de imóveis e um painel interno de gestão, ambos operando sobre a mesma base de dados. Toda alteração no painel reflete no site imediatamente, sem publicação manual. O sistema é operado em conjunto com um agente de IA no WhatsApp integrado ao Chatwoot, que consome uma API pública autenticada por token.

## Stack técnica

- Frontend: React + Vite + TypeScript
- Estilização: Tailwind CSS + Shadcn/UI
- Backend/Banco: Supabase (Postgres + Auth + Storage + Edge Functions)
- Roteamento: React Router
- Projeto Supabase: `imob_flow`

## Banco de dados

- `usuarios` — usuários do painel interno, vinculados ao Supabase Auth
- `api_tokens` — tokens de acesso à API pública, com controle de consumidor e revogação
- `configuracoes` — dados da imobiliária, registro único, alimenta site e API simultaneamente
- `logs_sistema` — registro de todas as ações do sistema
- `crm_imobiliaria` — tabela principal de leads, com campos do agente de IA e integração Chatwoot
- `tipos_imovel` — categorias de imóvel editáveis pelo painel
- `imoveis` — cadastro dos imóveis, com código gerado automaticamente
- `imoveis_fotos` — galeria de fotos, limite de 10 por imóvel
- `corretores` — cadastro dos corretores com cor de destaque
- `agendas` — agenda individual, criada automaticamente no cadastro do corretor
- `agendas_horarios` — janela de atendimento por dia da semana de cada corretor
- `agendamentos` — visitas aos imóveis em blocos de 30 minutos
- `visualizacoes_site` — rastreamento próprio de tráfego do site público

Um job de `pg_cron`: `minutos_ultima_mensagem`, de 1 em 1 minuto, que mantém a coluna de mesmo nome em `crm_imobiliaria` no valor real, para o agente ler direto da tabela. **Banco novo precisa da extensão `pg_cron`**, criada pela migration `…024`. É a única peça da instalação que falha sem dar erro: sem ela tudo sobe normalmente e só a régua de follow-up do agente fica lendo um número congelado. Detalhe em BANCO.md, seção 4.1.

Uma view: `info_imob_agente`, que devolve os dados de `configuracoes` — inclusive o horário de atendimento, agrupado em uma frase — em uma única coluna de texto, para o agente de IA ler pelo N8N e repassar ao cliente sem compor nada. **É a única fonte desses dados para o agente** — o endpoint `GET /imobiliaria`, que montava a mesma frase em TypeScript, foi removido justamente para não haver duas. Detalhe e motivo em BANCO.md, seções 2.14 e 3.

## Estrutura de páginas e rotas

O ImobFlow tem **duas áreas distintas dentro do mesmo projeto**, com layouts, navegação e identidade visual próprios. A separação é estrutural e deve ser preservada em todas as etapas.

- **Área pública** — a vitrine, sem login, nas rotas da raiz. Páginas em `src/paginas/publico`, layout `LayoutPublico`
- **Área privada** — o painel de gestão, protegido, sob o prefixo `/painel`. Páginas em `src/paginas/painel`, layout `LayoutPainel`

### Rotas

| Rota | Página | Acesso | Etapa |
|---|---|---|---|
| `/` | Site público (home) | Público | 6 ✅ |
| `/imoveis` | Listagem pública | Público | 6 ✅ |
| `/imovel/:codigo` | Página do imóvel | Público | 6 ✅ |
| `/login` | Login | Público | 2 ✅ |
| `/painel` | Dashboard | Protegida | 7 ✅ |
| `/painel/imoveis` | Imóveis (listagem) | Protegida | 3 ✅ |
| `/painel/imoveis/novo` | Cadastro de imóvel | Protegida | 3 ✅ |
| `/painel/imoveis/:id/editar` | Edição de imóvel | Protegida | 3 ✅ |
| `/painel/leads` | Leads (tabela) | Protegida | 5 ✅ |
| `/painel/funil` | Funil (Kanban) | Protegida | 5 ✅ |
| `/painel/agenda` | Agenda | Protegida | 4 ✅ |
| `/painel/corretores` | Corretores | Protegida | 4 ✅ |
| `/painel/configuracoes` | Configurações | Protegida | 8 ✅ |

Toda rota sob `/painel` passa por `RotaProtegida`, que redireciona ao `/login` quem não tem sessão. Existem duas páginas 404, uma por área, cada uma com o layout da sua.

**A 404 pública não é uma tela de erro comum.** Ela aparece com frequência prevista: a exclusão de imóvel é definitiva e links antigos de WhatsApp continuam circulando por meses. O texto explica que o imóvel pode ter sido vendido, alugado ou retirado, e oferece a busca como caminho — nunca trata o visitante como se ele tivesse errado o endereço.

### Sidebar

Agrupada por contexto de uso, com rótulo discreto por grupo. Sete itens em lista corrida obrigariam o usuário a ler todos para achar um.

| Grupo | Itens |
|---|---|
| Visão geral | Dashboard |
| Vitrine | Imóveis |
| Atendimento | Leads · Funil · Agenda |
| Cadastros | Corretores |
| Sistema | Configurações |

Separado dos grupos, ao final: **Ver site**, que abre a vitrine em nova aba.

A sidebar é fixa à esquerda no desktop, recolhível para modo compacto só com ícones (com tooltip, e a escolha persiste em `localStorage`), e vira menu sobreposto no mobile. Logo e nome vêm das Configurações em tempo real.

**Leads e Funil são a mesma tabela `crm_imobiliaria` em duas visualizações:** Leads é a lista com busca e filtros, Funil é o Kanban por status, em `/painel/funil`. Os rótulos nomeiam a visualização e não o conceito, para eliminar a dúvida de qual abrir. As duas telas trazem no topo o `AlternadorLeadsFunil`, que leva à outra **carregando a query string atual**. Por isso o estado de filtro vive na URL, no gancho `usarFiltrosLead`, e não em `useState` local — em estado local ele se perderia na troca.

O filtro de status é o único que existe em uma tela e não na outra, e a diferença é resolvida em vez de descartada: **na tela de Leads ele filtra as linhas; no Funil, escolhe quais colunas aparecem**, com um aviso e um atalho para mostrar todas. Descartá-lo em silêncio faria o alternador prometer que preserva o filtro e não preservar.

### A ficha do lead é um componente só

`PainelLead`, em `src/componentes/leads/`, é **compartilhado entre Leads e Funil**. Ele recebe apenas o id e busca o registro completo, em vez de receber o lead pronto: as duas telas carregam recortes diferentes, e a ficha precisa dos campos todos de qualquer forma.

Duplicar a ficha seria a forma mais silenciosa de as duas telas passarem a discordar sobre o mesmo lead — um campo novo apareceria em uma e não na outra, e ninguém perceberia até alguém tomar uma decisão pela tela desatualizada.

É painel lateral e não página porque o uso real é consultar vários leads em sequência. Navegar para uma página a cada consulta perderia a lista, a rolagem e o filtro — toda vez.

### Estrutura de pastas

```
src/
├── componentes/        Componentes globais reutilizáveis
│   └── ui/             Primitivos no estilo Shadcn
├── contextos/          Autenticação e Configurações
├── ganchos/            Hooks (usarTituloPagina)
├── layouts/            LayoutPainel, LayoutPublico, Sidebar, Header, menu
├── lib/                supabase, logs, notificacoes, utils
├── paginas/
│   ├── painel/         Telas da área privada
│   └── publico/        Telas da vitrine
└── tipos/banco.ts      Tipos gerados do schema do Supabase

supabase/
├── migrations/         SQL versionado, aplicado em ordem numérica
└── functions/
    ├── _compartilhado/ Ambiente, respostas, datas, autenticação, disponibilidade, configurações
    └── api/            Roteador e os handlers por recurso
```

Os tipos em `src/tipos/banco.ts` são **gerados do banco**, não escritos à mão. Ao alterar o schema, regere-os.

### Formulários longos usam página própria, não modal

O cadastro de imóvel tem seis seções e uma galeria de fotos. Em modal, isso vira uma caixa com rolagem interna: o usuário perde de vista o que já preencheu, o arrastar-e-soltar de fotos compete com a rolagem do modal, e um clique fora fecha tudo. Por isso `/painel/imoveis/novo` e `/painel/imoveis/:id/editar` são páginas.

A consequência disso é que sair da página descarta o trabalho — daí o aviso de alterações não salvas, via `useBlocker`. **É por causa dele que o roteador é `createBrowserRouter`** (roteador de dados) e não `<BrowserRouter>`: `useBlocker` não existe fora de roteador de dados.

**Regra para as próximas etapas:** formulário curto (corretor, tipo de imóvel) pode ser modal; formulário longo é página própria com aviso de saída.

### Cor de corretor vem de paleta fechada

`CORES_CORRETORES`, em `src/lib/coresCorretores.ts`, tem doze cores escolhidas para se distinguirem entre si mesmo em bloco pequeno. Não existe seletor livre, e o modal bloqueia as cores já usadas por outro corretor, dizendo por quem.

O motivo: a cor existe para distinguir de relance quem é cada visita na agenda. Escolhida à mão, a terceira pessoa pega um verde parecido com o da segunda e a cor deixa de resolver o problema para o qual foi criada — só que ninguém percebe até a agenda estar cheia, que é exatamente quando ler a agenda importa.

### Conflito e janela: banco é a fonte de verdade

As duas validações existem em dois lugares, com papéis diferentes:

- **No banco** (triggers 4 e 5) — quem manda. Vale para toda escrita, inclusive a do agente de IA pela API, e é o único ponto por onde os dois caminhos passam. As mensagens já saem em português e com o horário do conflito.
- **Na interface** (`verificarDisponibilidade`) — apenas antecipação. Ao escolher data e hora, cada corretor é marcado como disponível, ocupado ou fora da janela, antes de o usuário preencher o resto do modal.

A interface **avisa, não bloqueia**: entre o cálculo e o `insert` existe uma janela em que o agente de IA pode ter ocupado o horário. Quando o banco recusa, `notificar.erroDoBanco` exibe a mensagem do trigger em vez de um texto genérico.

Vale o mesmo para o funil: mudar o status de uma visita atualiza o lead por trigger. Cancelar só rebaixa o lead para `cancelou` se não restar outra visita agendada. **Não replique essa lógica no frontend** — apenas recarregue e reflita o resultado.

### A grade da Agenda esconde as canceladas

O filtro de status da Agenda tem um padrão, e ele **não é "tudo"**: sem `?status=` na URL, a grade traz todas as visitas **menos as canceladas**.

A agenda responde "o que vai acontecer", e visita cancelada não vai acontecer. O bloco hachurado ocupava visualmente um horário que está livre, e a hachura é lida como bloco antes de ser lida como cancelamento. **A visão de mês já as excluía desde a Etapa 4** — era o padrão da semana e do dia que estava fora de linha, não o contrário.

Elas continuam alcançáveis pelo filtro, em "Todas, com canceladas" ou "Só canceladas", e **isso não é zelo**: `reabrir`, em `DetalheVisita`, só existe a partir do bloco na grade. Sem caminho de volta, a ação viraria código morto e uma visita cancelada por engano não teria como ser recuperada pelo painel.

Duas consequências que vieram junto:

- **`STATUS_TODAS` precisa existir** porque "sem filtro" deixou de significar "tudo". Sem esse valor, a diferença entre os dois estados seria indizível pela URL, e a Agenda perderia a propriedade de ter o recorte compartilhável
- **A visão de mês não filtra mais por conta própria.** Depois que a página passou a fazer isso, a regra existia em dois lugares, e o sintoma era escolher "Só canceladas" e o mês abrir vazio

**O cálculo de disponibilidade não passa por aqui e não mudou.** `verificarDisponibilidade` recebe a lista crua e já descarta o que não é `agendada` nem `realizada`, então horário de visita cancelada sempre esteve livre para remarcação.

### O detalhe da visita diz quem marcou, e mostra a conversa quando existe

`DetalheVisita` traz duas informações que não estão na tabela `agendamentos` e que respondem à mesma pergunta: de onde veio esta visita.

**O selo de origem existe para os três casos**, e não só para o do agente. Antes, `agente_ia` tinha selo e o resto não tinha nada, então "painel" se lia pela ausência — e ausência não afirma nada: quem abre a ficha não sabe se a visita é do painel ou se o selo é que não apareceu. Os rótulos ficam em `ROTULOS_ORIGEM_VISITA`, em `src/lib/agendamentos.ts`. **`origem` nula fica sem rótulo de propósito**: registro antigo não tem como dizer quem o criou, e chutar "painel" seria afirmar o que não se sabe.

**O resumo da conversa aparece só quando a visita veio do agente**, em um bloco com o motivo do contato, o resumo e a hora da última mensagem. Três decisões dentro dele:

- **A consulta é sob demanda**, por `buscarAtendimentoDoLead`, e não entra na seleção de `listarVisitas`. Aquele select alimenta a grade inteira da semana: `resumo_conversa` é texto corrido, e carregá-lo por bloco baixaria dezenas de resumos para exibir, no máximo, um
- **Há guarda contra resposta fora de ordem.** Abrindo uma visita e trocando para outra antes de a primeira responder, o resumo de uma cairia dentro da outra
- **O vazio diz o que houve.** Visita do agente sem resumo mostra "O agente não gravou resumo desta conversa", em vez de sumir. O selo no topo já prometeu uma conversa, e um bloco em branco pareceria erro de carregamento. É a regra oposta da ficha do lead, onde a seção some por completo, porque lá nada foi prometido

Uma lacuna conhecida: o lead que conversou com o agente mas teve a visita marcada à mão por um corretor não mostra o bloco, porque a condição é a origem da visita, não a existência da conversa.

### Dashboard: faixa fixa e duas abas

O Dashboard responde a **duas perguntas diferentes** — "meu site está funcionando?" e "minha operação está funcionando?" — e a estrutura existe por causa disso:

```
Seletor de período (global, na URL)
Faixa fixa: Leads novos · Visitas · Visitas no site · Imóveis ativos
Abas: [ Site ] [ Operação ]
```

**Por que abas e não duas páginas.** Separadas no menu, o dono precisaria lembrar em qual delas mora cada número, e acabaria abrindo só uma. Numa tela corrida, virariam treze cartões empilhados que ninguém lê até o fim. Com abas, os quatro números que ele sempre quer ficam fixos no topo e o aprofundamento é escolhido.

**Período e aba vivem na URL**, então um recorte pode ser retomado e compartilhado — inclusive entre as duas abas, que é onde a comparação faz sentido. O período é global de propósito: um seletor por aba produziria a situação em que se compara o tráfego de 7 dias com o funil de 30 e se conclui algo errado sobre a conversão.

**Só a aba visível consulta.** Não faz sentido pagar por sete agregações que talvez ninguém veja.

Cada bloco carrega sozinho, via `usarBloco`, e carrega o próprio erro: uma consulta que falha mostra o aviso naquele cartão e o resto da página continua útil.

### Contador acumulado não responde por período

Distinção que precisa sobreviver às próximas etapas, porque os dois números parecem a mesma coisa e não são:

| Onde | O que é | Quando usar |
|---|---|---|
| `imoveis.total_visualizacoes` e `total_cliques_whatsapp` | Acumulado **desde sempre**, mantido pelo trigger 10 a cada evento | Quando o total histórico do imóvel é o desejado |
| `visualizacoes_site` | O evento cru, com `created_at` | **Sempre que houver recorte de período** |

Os rankings do Dashboard são por período, então leem `visualizacoes_site` — nunca os contadores. Um ranking construído sobre o acumulado responderia "quem foi mais visto na história" mesmo com o seletor em "últimos 7 dias", e o número não mudaria ao trocar o período, o que parece um filtro quebrado.

O acumulado continua valendo a pena: é ele que evita varrer a tabela de eventos toda vez que a listagem do painel quer mostrar o total de um imóvel.

### Agregação é do banco, não do frontend

As contagens do Dashboard vivem em funções do Postgres — `supabase/migrations/…015_dashboard_agregacoes.sql`, documentadas em BANCO.md. `src/lib/dashboard.ts` só chama e formata; **nenhuma soma acontece no frontend**.

O motivo chega rápido: `visualizacoes_site` recebe uma linha por página vista do site público. Somar isso no navegador significaria baixar meses de tráfego a cada abertura do painel — funcionaria na demonstração e travaria no terceiro mês do cliente.

O agrupamento por dia usa o fuso de `configuracoes`, e não UTC. Uma visita às 22h de segunda em São Paulo é terça em UTC: agrupar em UTC jogaria o movimento da noite para o dia seguinte, e o gráfico de dias da semana — que existe para dimensionar equipe — apontaria o dia errado.

### Gráficos são SVG próprio

`src/componentes/dashboard/Graficos.tsx` traz área, barras horizontais e rosca, em SVG, sem biblioteca. Mesma razão de não haver biblioteca de data nem de arrastar-e-soltar: o Dashboard precisa de três formas simples, e uma dependência de gráficos custaria algumas centenas de kB no bundle e imporia um tema visual estranho ao resto do sistema.

As barras são horizontais porque os rótulos são palavras — dias da semana, tipos de imóvel, etapas do funil. Na vertical precisariam ser abreviados ou girados, e rótulo girado ninguém lê.

### Configurações: quatro abas, três destinos

`/painel/configuracoes` tem quatro abas, todas refletidas na URL em `?aba=`:

| Aba | O que faz |
|---|---|
| `dados` (padrão) | Formulário do registro único de `configuracoes`, incluindo o horário de atendimento |
| `tipos` | Gestão de `tipos_imovel`, com ordem por arrastar |
| `api` | Tokens de `api_tokens`, e o espaço da documentação da Etapa 9 |
| `logs` | Consulta de `logs_sistema`, somente leitura |

**O que é salvo na aba de Dados alimenta três destinos ao mesmo tempo** — o painel, o site público e a API que o agente de IA consome. Não existe publicação: salvar já muda a vitrine, porque as três leituras saem da mesma linha da mesma tabela.

Por isso cada seção do formulário exibe **onde aqueles dados aparecem**, via `DestinoDado`. Sem essa marcação o formulário parece cadastro interno, e o erro daí é invisível nos dois sentidos: ou alguém publica o número pessoal na vitrine achando que era anotação da equipe, ou deixa o WhatsApp vazio por cautela e o site fica sem o único botão que gera contato.

**A aba de Dados é a única com estado sujo.** As outras três gravam a cada ação. Trocar de aba desmonta o formulário e descartaria o que foi digitado, então a troca de aba passa pelo mesmo aviso da saída da página — `useBlocker` para a rota, e uma confirmação própria para a aba.

O campo de **fuso horário** vive aqui, e não numa constante: os triggers de conflito e de janela convertem pelo fuso desta tabela. Uma imobiliária de Manaus com o campo em São Paulo ofereceria horários que o banco recusa.

### Horário de atendimento não é janela de visita

`configuracoes.horario_funcionamento` (migration `…023`) guarda quando a **imobiliária atende o público**, um intervalo por dia da semana. Fica colado no fuso horário na aba de Dados, porque os dois respondem à mesma pergunta: como o tempo funciona nesta imobiliária. São seções separadas e não uma só porque os destinos diferem, e fundi-las faria o `DestinoDado` prometer errado dos dois lados.

**Ele é declarativo, e essa é a linha que não pode ser cruzada.** Quem decide se um agendamento cabe continua sendo `agendas_horarios`, a janela de cada corretor, validada pelos triggers 4 e 5. Nada é agendado nem recusado por este campo. Os dois existem porque são diferentes de verdade: a imobiliária abre das 9h às 18h e pode fazer visitas só das 10h às 16h.

O risco é declarar **mais largo** do que a equipe cobre, porque aí o agente promete um horário que o banco nega, e a recusa chega ao cliente sem que ninguém no painel saiba de onde veio. Por isso `conferirCoberturaCorretores` compara os dois ao editar e avisa. **Avisa e deixa salvar**, pela mesma regra de sempre: a interface antecipa, o banco decide. A comparação é por extremos, então uma pausa no meio do dia passa despercebida — foi escolhido assim porque o caso que queima é o extremo, e checar intervalos vagos acusaria toda imobiliária que fecha para o almoço.

Três decisões de forma:

- **Um intervalo por dia, sem pausa de almoço.** É a limitação conhecida, e ela aparece no primeiro cliente que fecha ao meio-dia
- **Nenhum dia aberto grava `null`.** Os dois diriam a mesma coisa a quem lê, e imobiliária fechada a semana inteira não existe: o estado real é "ainda não informado". Com `null`, a view e o site omitem o bloco pela mesma regra dos outros campos vazios
- **A frase é montada em dois lugares** — `fn_horario_funcionamento_legivel` no banco e `resumoHorario` em `src/lib/horarioFuncionamento.ts`. A duplicação é consciente: no banco ela serve ao agente, no frontend ela é a prévia que o operador lê antes de salvar, e uma prévia que não fosse a frase exata não teria utilidade. **Mexeu numa, mexa na outra**

Na vitrine ele aparece na seção "Sobre a imobiliária", logo depois do endereço, **em linhas e não na frase corrida** que o agente recebe. Ali existe layout e o olho varre a coluna dos dias procurando o de hoje; no WhatsApp não existe layout, e lá a frase é a única forma possível.

O **endereço do site** (`url_site`) é a outra seção de implantação da aba, e vai para um destino só: a API. É dele que sai o link da página de cada imóvel que o agente manda ao cliente. Ela traz a prévia de como o link vai ficar, porque o erro aqui é silencioso: domínio digitado errado salva sem reclamar, e o defeito só aparece semanas depois, na conversa de alguém que clicou e não abriu. Ficou **fora do `BlocoProntidao`** de propósito: os quatro itens de lá são os que fazem o site abrir e não funcionar, e este não afeta o site, afeta o agente.

### O bloco de prontidão desaparece quando está tudo certo

No topo da aba de Dados, `BlocoProntidao` lista o que falta para o site poder ser divulgado: nome, WhatsApp, logo e ao menos um imóvel ativo.

Não é um checklist genérico de cadastro. Os quatro itens têm em comum o fato de que, faltando, **o site abre normalmente e não funciona** — que é o pior tipo de falha, porque não gera erro nenhum. Por isso cada item diz a consequência, não a repetição do rótulo.

Some quando tudo está resolvido. Um bloco verde permanente ocuparia o topo da tela repetindo uma informação que só interessa uma vez, e treinaria o olho a ignorar aquela região — justo onde o aviso apareceria de novo se alguém apagasse a logo.

### O valor do token nunca entra no log

`api_tokens.token` é guardado em texto e continua recuperável pela tela: é assim que ele vai para o N8N, e o índice `idx_api_tokens_token … where ativo` é como a Etapa 9 vai validá-lo. O mascaramento na lista é conforto visual, não barreira — quem protege o token é o RLS, que nunca expõe a tabela a `anon`.

**O que não pode acontecer é o valor entrar em `logs_sistema`.** A tabela tem política de select e de insert e **nenhuma de update ou delete**: o que entra ali não sai mais. Registrar a linha crua gravaria o segredo em texto puro, de forma permanente, num lugar que qualquer usuário do painel lê e que uma revogação futura não teria como limpar.

É o que a função `semSegredo`, em `src/lib/tokens.ts`, existe para impedir. Toda gravação de log de token passa por ela. **Qualquer código novo que mexa em `api_tokens` precisa passar também.**

### Desativar e excluir tipo de imóvel não são a mesma coisa

`imoveis.id_tipo_imovel` usa `ON DELETE RESTRICT`, então tipo em uso não sai do banco. Isso é proposital: sem o RESTRICT, apagar "Apartamento" apagaria em cascata todos os apartamentos do estoque.

A interface traduz o erro em vez de exibi-lo — diz **quantos imóveis usam** aquele tipo e aponta a desativação como saída. Desativar tira o tipo dos cadastros novos e dos filtros do site e **não mexe nos imóveis que já o usam**, que continuam publicados.

A ordem da lista é gravada em `tipos_imovel.ordem` por arrastar, e é a ordem exibida nos filtros do site. A gravação é uma atualização por linha, só nas que mudaram: um `upsert` em lote seria uma chamada só, mas `nome` é UNIQUE e o insert do upsert pode bater no índice do nome antes da chave primária — aí o `on conflict` da primária não é acionado e o banco recusa tudo.

### A trilha de auditoria é lida por função, e a busca entra no conteúdo

A aba de Logs consulta `fn_logs_listar` (migration `…016`), não a tabela direto. Três motivos, todos concretos:

- **Busca dentro do `jsonb`.** Quem digita "IMV-0042" procura um imóvel que provavelmente não existe mais — a exclusão é definitiva, e o código só sobrevive dentro de `dados_anteriores`. Sem varrer o conteúdo, a única rastreabilidade que resta de uma exclusão fica inalcançável justamente no caso em que ela é tudo o que sobrou.
- **A categoria da ação** (`fn_log_categoria`) sai do sufixo do nome, e a regra vive num lugar só. Se filtro e rótulo discordassem, filtrar por "exclusão" traria uma lista que o próprio rótulo da linha contradiz.
- **O total real vem junto da página**, por window function. Duas consultas separadas saem de sincronia no dia em que alguém mudar um filtro num lugar e esquecer do outro.

A busca usa `strpos` e não `ilike`: o termo vem digitado, e um `%` perdido no meio de um código viraria curinga sem que ninguém entendesse por que a lista cresceu.

**A tela não oferece nenhuma ação de alteração, e o banco também não permitiria.** Log que pode ser editado não é log.

O detalhe é painel lateral pela mesma razão da ficha do lead: o uso real é conferir vários registros em sequência. Numa edição, ele mostra **só os campos que mudaram** por padrão — num imóvel são quarenta campos, e listar todos enterra justamente o que se veio procurar. Numa exclusão, mostra o registro inteiro.

### A mensagem do WhatsApp carrega o código

`mensagemDeInteresse`, em `src/lib/whatsapp.ts`, monta o texto que já vai escrito quando o visitante toca no botão:

```
Olá! Tenho interesse no imóvel IMV-0042.
```

**O código é o elemento central da frase, não um detalhe dela.** É ele que permite ao agente de IA responder sobre aquele imóvel na primeira resposta, em vez de começar o atendimento perguntando "qual imóvel você viu?" — que é exatamente a pergunta em que o contato esfria, porque a pessoa já fechou a aba e não sabe mais dizer.

É uma frase natural, e não o código solto, porque quem recebe conversa como pessoa: "IMV-0042" sozinho na caixa de entrada parece engano de envio.

Mudar o texto da frase é seguro. **Tirar o código quebra a integração inteira** — o agente perde a única pista de contexto que tinha, e o rastreamento perde o vínculo entre o clique e o imóvel.

### O endereço exato não vai para a vitrine

A página do imóvel exibe **bairro, cidade e estado**. Nunca rua, número ou complemento.

O motivo é de segurança do proprietário: imóvel anunciado com frequência está vazio, e publicar o endereço exato de um imóvel vazio, junto com fotos do interior e o horário em que ninguém está lá, é informação que não deveria estar aberta na internet. Quem precisa do endereço recebe no atendimento, depois do primeiro contato.

A proteção é mais forte do que "não renderizar": **as colunas de endereço nem são buscadas**. `CAMPOS_CARD` e `CAMPOS_DETALHE`, em `src/lib/publico.ts`, não incluem `cep`, `endereco`, `numero` nem `complemento` — o que não trafega não pode vazar pela aba de rede do navegador.

O mesmo vale para `proprietario_nome` e `proprietario_contato`. E aqui a seleção explícita não é zelo extra, é a única proteção que existe: **o RLS protege linha, não coluna.** A política `imoveis_anon_leitura_ativos` libera a linha inteira do imóvel ativo para o visitante anônimo — um `select('*')` na vitrine entregaria o telefone do dono a qualquer um, sem nada aparecer na tela.

### Só ativos, e o filtro é explícito

Toda consulta da vitrine passa por `somenteAtivos`, que aplica `.eq('status', 'ativo')`.

**Não é redundância com o RLS.** A política vale para o papel `anon`; o operador que abre o site pelo link "Ver site" do painel está autenticado, e para `authenticated` a política é `using (true)`. Sem o filtro explícito ele veria na vitrine os imóveis que acabou de desativar, concluiria que a desativação não funciona, e desativaria de novo.

### O painel não exibe nada do Chatwoot

A ficha do lead já teve um botão "Conversa no Chatwoot", montado a partir de `id_conta_chatwoot` e `id_conversa_chatwoot` mais uma `VITE_CHATWOOT_BASE_URL`. **Saiu, e a variável de ambiente saiu junto.**

O motivo não é o link, é o que ele exigia para existir. O botão dependia de uma configuração de implantação que na prática ninguém preenche, e sem ela sumia. Explicar a ausência obrigava a ficha a citar o nome de uma variável de ambiente para o corretor que a usa todo dia, e essa é a troca que não fecha: o aviso servia a quem implanta uma vez e atrapalhava quem trabalha ali todo dia.

**As quatro colunas continuam em `crm_imobiliaria`** e continuam sendo gravadas pelo N8N. Elas são do atendimento, não da interface, e a integração prevista com a API do Chatwoot, quando existir, é do lado das Edge Functions com o token nos secrets. O que não volta é tela.

### Um formato de telefone, e um lugar só que decide

O `whatsapp` do lead é gravado em **E.164 sem o sinal de mais**: código do país mais o número nacional, só dígitos. `5511971351311` no Brasil, `351912345678` em Portugal. É o mesmo formato que o agente grava pelo N8N e o mesmo que o `wa.me` aceita, então nada é convertido no caminho.

**Havia dois formatos convivendo, e o defeito era invisível.** A Edge Function removia o `55` antes de gravar; o agente, escrevendo direto na tabela, gravava o número completo. A mesma pessoa virava duas linhas, uma por caminho, e o UNIQUE não pegava, porque as strings diferem. O sintoma aparece longe da causa: o lead "some" na busca, o histórico de visitas fica no cadastro errado e o funil mostra dois cards para o mesmo telefone. A migration `…020` normalizou o que já existia.

A causa raiz era **a regra existir em cópias**. Havia uma em `agenda.ts` e outra em `contexto.ts`, e corrigir uma sem a outra fez `/leads/:whatsapp` parar de achar o que `/agenda/agendar` acabara de gravar. Hoje existe uma função só de cada lado da fronteira:

| Onde | Arquivo |
|---|---|
| Edge Functions | `supabase/functions/_compartilhado/telefone.ts` |
| Painel e vitrine | `src/lib/telefone.ts` |

**Endpoint novo que receba telefone importa de `_compartilhado/telefone.ts`.** Tela nova que digite telefone usa `CampoWhatsapp`, que já traz o seletor de país com o Brasil escolhido, a trava de dígitos por país e a remoção do DDI colado por engano.

A regra de comprimento é por país, não um número fixo: 10 ou 11 dígitos no Brasil, 9 em Portugal, 10 nos Estados Unidos. Um mínimo único, como o antigo "pelo menos 10", aceitava `11999999999999` sem reclamar, que foi o que motivou tudo isso.

Duas coisas que ficaram conscientemente de fora. **Não existe CHECK de formato na coluna**: ele protegeria contra escrita torta do N8N, que roda com service role e ignora o RLS, mas faria o cadastro de lead do agente falhar em produção no primeiro número com máscara. O comando está comentado no fim da migration `…020`, para o dia em que o fluxo for auditado. E **número de 10 ou 11 dígitos é lido como brasileiro**, o que é ambíguo com um celular dos Estados Unidos em E.164; o desempate é o público desta base.

### Tempo relativo é recalculado no painel, e envelhecido por job para o agente

A coluna `minutos_ultima_mensagem` é gravada pelo trigger 9 no instante em que `ultima_mensagem` muda. Sozinho, o trigger produz um **retrato, não um relógio**: um lead parado há três dias mostraria "há 2 minutos" para sempre, justamente o lead que ninguém pode deixar esfriar.

Os dois leitores resolvem isso de formas diferentes, e é proposital:

- **O painel ignora a coluna.** Usa `tempoRelativo` de `src/lib/datas.ts`, que calcula a partir do instante. Sempre exato, sem depender de nada ter rodado
- **O agente lê a coluna crua**, porque o N8N consulta `crm_imobiliaria` direto, sem view nem endpoint no caminho. Para esse leitor, o número precisa estar certo na tabela

Daí o job `minutos_ultima_mensagem` (migration `…024`), de 1 em 1 minuto, documentado em BANCO.md, seção 4.1. Ele reescreve a coluna em todo lead com conversa.

**Duas guardas existem só por causa dele, e quebram em silêncio se alguém as remover:**

- **`trg_crm_imobiliaria_updated_at` ganhou um `WHEN`.** Sem ele, o job carimbaria `updated_at` em todo lead a cada minuto, e a coluna deixaria de responder "quando esse lead foi mexido pela última vez"
- **O Funil sai cedo do evento de Realtime**, por `soMudouORelogio` em `src/lib/leads.ts`. O job vira um UPDATE por lead por minuto, e recarregar a coluna do Kanban a devolve à primeira página: quem tivesse clicado em "carregar mais" perderia o que abriu, sozinho, de minuto em minuto

**Tela nova que ouça `crm_imobiliaria` por Realtime precisa da mesma saída antecipada.** É a pegadinha que este job introduziu: o evento chega sem nada ter acontecido com lead nenhum.

### Fuso horário na agenda

`src/lib/datas.ts` converte entre instante absoluto (`timestamptz`) e hora de parede no fuso de `configuracoes.fuso_horario`, sem biblioteca externa. Usar a hora local do navegador seria mais simples e estaria errado: os triggers convertem pelo fuso da tabela, então uma máquina em outro fuso ofereceria horários que o banco recusa. Quando os dois divergem, a Agenda exibe um aviso.

## Sistema de design

Todos os valores de cor, tipografia e forma vivem em **`src/index.css`**. Nenhum componente escreve cor ou tamanho solto.

### Cor de destaque — ponto único de troca

A variável `--cor-destaque` no topo de `src/index.css` é o único lugar a mudar para trocar a identidade em uma nova imobiliária. Ela alimenta botões, links, item ativo da sidebar, foco de campo, coluna visual do login, o fundo da barra lateral do painel e destaques da vitrine. As três derivadas (`--cor-destaque-hover`, `--cor-destaque-contraste`, `--cor-destaque-suave`) acompanham, mantendo a mesma matiz.

Padrão do ImobFlow: verde sóbrio e natural — solidez, não pressa.

### A barra lateral é escura, e a cor dela é calculada

O bloco `1b` de `src/index.css` traz os tokens `--sidebar-*`. O fundo é `color-mix(in oklab, var(--cor-destaque) 60%, black)`, ou seja, o verde da marca levado a cerca de 40% da luminosidade original.

**Antes ela era branca**, `--superficie`, sobre um conteúdo em `--fundo`, cinza quase branco. São 2,8 pontos de luminosidade de diferença: quem separava as duas regiões era uma borda de 1px, e o painel inteiro lia como uma superfície só.

**Nenhum valor da barra é escrito à mão, e essa é a decisão que precisa sobreviver.** A sidebar é a maior área de cor do sistema. Escrita como um verde absoluto, ela seria a única parte do painel que ignoraria a troca de identidade, e a primeira imobiliária de marca vermelha teria botões vermelhos ao lado de uma barra verde. Derivada, ela acompanha as quatro linhas do bloco `1` sozinha.

Pelo mesmo motivo, o hover, o item ativo e as bordas internas são **branco com transparência**, não cores calculadas: transparência funciona sobre qualquer matiz que `--cor-destaque` venha a ter.

Três consequências que não são a cor de fundo e quebram se ninguém olhar:

- **O item ativo distingue por luminosidade, não por matiz.** Sobre verde escuro, o antigo `bg-destaque-suave` com texto verde virava um borrão. Hoje é branco a 13% com texto claro, e o marcador lateral é um verde clareado
- **A logo fica sobre um quadrado branco.** Boa parte das logos chega em PNG transparente com o traço escuro, e solta no fundo escuro ela desaparece. O erro só apareceria na implantação de um cliente
- **O anel de foco dentro da barra é claro**, pela regra `[data-sidebar] :focus-visible`. O anel verde padrão cairia sobre o próprio verde e sumiria, justo para quem navega por teclado

O `Sheet` do mobile monta o mesmo componente `Sidebar`, então herda tudo sem código próprio.

### Paleta base

Neutra e profissional, para servir a qualquer imobiliária. Cinzas **quentes**, nunca azulados: fundos em branco e cinza claro, texto em cinza bem escuro próximo do preto mas nunca preto puro, bordas discretas. O painel é claro; a barra lateral é a única área escura do sistema, e é o que dá o contraste entre navegação e conteúdo.

### Cores do funil

Sete cores, uma por etapa do lead, declaradas como `--status-*` em `src/index.css` e expostas ao Tailwind no bloco `@theme`. Não são decorativas: são o que permite reconhecer a etapa de relance, e o badge da tabela de Leads usa exatamente a mesma cor da coluna do Kanban.

`follow_up_1` e `follow_up_2` compartilham a matiz de propósito — são a mesma família de propósito — e se distinguem pela luminosidade. Matizes diferentes ali diriam "são coisas diferentes", que é o oposto do que são.

As classes ficam escritas por extenso em `ETAPAS_FUNIL`, em `src/lib/leads.ts`. Montar `bg-status-${chave}` não funcionaria: o Tailwind lê o código como texto e só gera as classes que encontra escritas — a cor sairia sem estilo, e só em produção.

### Tipografia

Uma família só, sem serifa, com boa variação de peso — **Inter**, declarada em `--font-sans` no bloco `@theme` de `src/index.css` e carregada no `index.html`.

### Formas

Cantos arredondados generosos (`--raio`, 0.75rem), sombras suaves e discretas, espaçamento que deixa o layout respirar.

### Direção visual das duas áreas

- **Painel** — ferramenta de trabalho. Prioriza densidade de informação: sidebar fixa e escura, conteúdo em cards brancos sobre fundo cinza claro, tabelas com boa quantidade de linhas por tela. Sóbrio e funcional, sem decoração. Classes `.titulo-pagina`, `.titulo-secao`, `.rotulo-grupo`, `.texto-apoio`, `.cartao`
- **Site público** — vitrine. Prioriza impacto visual: mais aberto, mais respirado, foto como elemento dominante, escala tipográfica maior e mais contraste entre título e corpo. Mesma família e mesma cor de destaque, para coerência de marca. Classes `.titulo-vitrine`, `.subtitulo-vitrine`, `.titulo-secao-vitrine`, `.container-vitrine`, `.secao-vitrine`

A vitrine é construída **a partir da tela pequena**. O acesso chega majoritariamente por link de WhatsApp, aberto no celular: no mobile os filtros secundários começam recolhidos, a galeria vira carrossel deslizável e o botão de WhatsApp fica fixo na base da página do imóvel, ao alcance do polegar.

### A coluna visual do login repete a sidebar

O login é a única tela que não pertence a nenhuma das duas áreas: é a porta do painel, mas quem a vê ainda não entrou. A coluna verde à direita traz quatro cartões com ícones do ramo, e cada um **nomeia uma área que existe de verdade na sidebar** — carteira de imóveis, agenda de visitas, funil de atendimento e vitrine sempre no ar.

Isso é uma escolha de conteúdo, não de decoração: é a primeira tela de toda implantação, e quem abre pela primeira vez descobre ali o que o sistema faz sem precisar entrar. Ícone genérico de tecnologia ocuparia o mesmo espaço sem dizer nada.

A lista vive em `AREAS`, no topo de `src/paginas/Login.tsx`. **Ao criar ou renomear uma área na sidebar, revise essa constante:** a coluna promete o que o painel entrega, e a divergência é do tipo que ninguém percebe, porque quem já usa o sistema não olha mais a tela de login.

O nome da imobiliária ali vem de `nomeNegocio`, do contexto de configurações, e nunca é escrito no código. Salvar outro nome em Configurações muda o login junto, como muda a sidebar. A coluna some abaixo de `lg`: no celular o login é só o formulário.

### A home é uma vitrine, não uma chamada para a listagem

A seção de imóveis da home mostra **24 cartões** (`QUANTIDADE_DESTAQUES`) com um seletor de categorias por cima. Eram seis, e seis obrigavam a trocar de página antes de o visitante ter qualquer noção do estoque. O custo é de fotos, não de consulta: `CAMPOS_CARD` já traz só a capa, e tudo fora da primeira dobra carrega em `lazy`.

**A categoria escolhida vive na URL, em `?tipo=`.** Mesma razão dos filtros da listagem e do funil: o recorte precisa poder ser mandado por WhatsApp, que é como esta vitrine circula. A troca usa `replace`, para o botão "voltar" não percorrer os chips um a um antes de sair da home.

**O filtro é no banco, não na lista já baixada.** Filtrar os 24 em memória mostraria 2 chácaras a quem escolheu "Chácara" numa carteira que tem 10, e o número no próprio botão diria o contrário.

Quatro decisões que sustentam isso:

- **Os chips do hero apontam para a grade desta mesma página** (`/?tipo=…#imoveis`), e não mais para `/imoveis`. Dois conjuntos de chips com os mesmos nomes fazendo coisas diferentes na mesma tela é armadilha. Continuam sendo `Link`, então continuam compartilháveis
- **Só aparecem categorias com estoque**, por `listarTiposComEstoque`. Categoria que abre vazia é pior do que categoria que não aparece. `listarTiposVitrine` continua devolvendo todo tipo ativo, porque alimenta o campo de busca, onde a opção sem estoque ainda faz sentido
- **O número ao lado do nome não é enfeite.** Ele diz o tamanho de cada categoria antes do clique. E como a grade tem teto de 24, quando o total é maior a página diz "Mostrando 24 de 30" com o caminho para a listagem: o botão anunciar 30 e a tela mostrar 24 é uma contradição que o visitante enxerga sem procurar
- **A capa do hero é congelada na primeira carga.** Vinha de `destaques[0]`, que muda a cada troca de categoria: escolher "Chácara" lá embaixo trocaria a foto da primeira dobra, fora da tela, e o visitante rolaria de volta para uma página com outra cara

**A rolagem até a âncora é do `LayoutPublico`, e precisa existir.** O navegador rola sozinho num link comum, mas não numa navegação de SPA: o `#imoveis` entraria no endereço sem nada acontecer na tela, e o chip do hero filtraria a grade deixando o visitante parado no topo. O deslocamento do cabeçalho fixo vem do `scroll-mt-*` do alvo, e não de um número no efeito, porque a barra muda de altura entre celular e desktop.

### O mapa aparece uma vez por página, e vem do endereço

O endereço da imobiliária tem dois lugares na vitrine: a seção **"Sobre a imobiliária"**, no fim da home, em duas colunas com o texto à esquerda e o mapa à direita; e o rodapé, em todas as páginas.

**O rodapé esconde o mapa na home**, porque a seção acima já mostra o mesmo endereço em tamanho grande, a uma rolagem de distância. Dois mapas do mesmo lugar na mesma tela fazem o menor parecer erro de layout. A decisão é pela rota (`useLocation`), e não por prop, pela mesma razão do `modoPorRota` do contexto de configurações: é comportamento, não estrutura, e precisa sobreviver a quem mover o rodapé de lugar.

**O mapa não vem de `link_google_maps`, e isso não é preferência.** O que a pessoa cola naquele campo é o link de compartilhamento (`maps.app.goo.gl/…`), e a URL comum do Maps responde `X-Frame-Options: SAMEORIGIN`, o que impede o iframe. Só `output=embed` é servido sem esse cabeçalho. Por isso a busca é montada a partir de rua, cidade, estado e CEP das Configurações, o que também dispensa chave de API e não pede nada de novo a quem implanta. `link_google_maps` continua servindo ao "Como chegar" da página do imóvel, onde é link mesmo e funciona.

**Exige rua e cidade.** Sem as duas, nenhum mapa é renderizado. Só com a cidade, ele apontaria para o centro do município e responderia "onde estamos" com um lugar onde a imobiliária não está.

`montarEndereco` e `consultaDoMapa` vivem em `src/lib/enderecoNegocio.ts`, e o iframe em `MapaEndereco`. Passaram a ter dois consumidores no mesmo dia em que a seção da home nasceu: copiados, o primeiro campo novo do cadastro apareceria em um e não no outro.

### O cabeçalho não tem botão de WhatsApp

O contato acontece onde existe assunto: no botão de cada imóvel, que já leva o código na mensagem, e no rodapé. Um botão de conversa no topo da home abre um atendimento sem contexto, e o agente começa perguntando o que a pessoa procura — que é a pergunta que o site inteiro existe para responder antes do WhatsApp.

A consequência a conhecer: **no celular, home e listagem ficam sem chamada de WhatsApp acima do rodapé.** Na página do imóvel continua o botão fixo na base, que é o que importa, porque é lá que existe um imóvel para citar.

### Prévia do link compartilhado tem um limite conhecido

`usarMetadados` escreve as tags Open Graph da página atual, e a página do imóvel monta título, descrição e foto de capa a partir do registro.

**Isso não basta para a prévia do WhatsApp em produção, e o limite é do tipo de aplicação.** O ImobFlow é uma SPA: o HTML servido é uma casca vazia e as tags só existem depois que o React monta. O robô de prévia do WhatsApp, do Facebook e do Telegram não executa JavaScript — lê o HTML cru e vai embora.

Fechar essa lacuna é decisão de publicação, não de aplicação: pré-renderização no build ou uma função de borda que responda ao user-agent do robô com o HTML já preenchido. Fica para a Etapa 11 (deploy), e está registrado no README para não virar surpresa no dia do primeiro compartilhamento.

### Título da aba

Montado em tempo de execução pelo hook `usarTituloPagina`, a partir do nome vindo das Configurações. No painel, `Página · Imobiliária`; no site público, `Imobiliária — descrição`, e nas páginas de imóvel, `Imóvel · Imobiliária`. Enquanto as configurações carregam, cai para um nome neutro em vez de exibir vazio. O favicon próprio está em `public/favicon.svg`.

## Contexto global de configurações

`ProvedorConfiguracoes` carrega o registro único de `configuracoes` e o distribui para as duas áreas — sidebar, login e vitrine. **O comportamento muda por área, e isso é deliberado:**

- **Modo `painel`** (`/painel/*` e `/login`) — leitura com subscription de Realtime ativa. O que o dono salva em Configurações aparece na sidebar na hora, sem recarregar
- **Modo `publico`** (rotas da raiz) — leitura anônima simples, uma vez no carregamento. Basta, porque o visitante não altera configuração nenhuma

O motivo da distinção: o Realtime trabalha sobre conexão autenticada. Ativar a subscription indiscriminadamente ou falha em silêncio no site público, ou obriga a área pública a depender do contexto autenticado — e aí o acesso anônimo quebra.

A escolha do modo é feita pela função `modoPorRota`, **não pelo lugar onde o provider foi montado**. A diferença é comportamental, não estrutural, e precisa sobreviver a uma reorganização da árvore de componentes.

Para a subscription funcionar, `configuracoes` está na publicação `supabase_realtime` (migration `…013`). Sem isso, o canal conecta e nunca recebe evento — falha silenciosa, sem erro no console.

## Regras de negócio críticas

Estas regras não podem ser violadas em nenhuma etapa da construção:

- **Exclusão de imóvel é definitiva.** Não existe exclusão lógica em `imoveis`. O registro sai do banco e não retorna em nenhuma consulta do painel, do site ou da API. A rastreabilidade fica em `logs_sistema`.
- **Desativação de imóvel é reversível.** Remove da vitrine e das consultas de disponíveis na API, mas preserva o registro.
- **`whatsapp` é a chave natural do lead.** É UNIQUE em `crm_imobiliaria`. O agente de IA deve operar por upsert, nunca por "buscar e criar".
- **O `whatsapp` é gravado em E.164 sem o mais**, ou seja, código do país seguido do número nacional, só dígitos: `5511971351311`. Vale para todos os caminhos de escrita, painel, API e N8N. Ver "Um formato de telefone, e um lugar só que decide".
- **Corretor é livre.** Não existe vínculo fixo entre corretor e imóvel. Qualquer corretor disponível pode conduzir qualquer visita.
- **A janela de atendimento vive no corretor**, em `agendas_horarios`, não numa configuração global. Cada corretor tem disponibilidade própria e independente. `configuracoes.horario_funcionamento` é outra coisa: o horário de atendimento ao público, declarativo, que não valida agendamento nenhum.
- **Bloco de visita é de 30 minutos.**
- **Limite de 10 fotos por imóvel**, validado no banco e na interface.
- **O código do imóvel é gerado automaticamente**, nunca digitado.

## Convenções do projeto

- Todo o conteúdo do sistema em português do Brasil
- Nomenclatura de tabelas e colunas em português, com underline
- Nomes de arquivos, componentes, funções e variáveis também em português
- Toda exclusão exibe modal de confirmação — use `ModalConfirmacaoExclusao`, sem exceção
- Todas as ações relevantes registradas em `logs_sistema` — use `registrarLog` de `src/lib/logs.ts`, nunca escreva na tabela direto
- Toda mensagem ao usuário passa por `notificar` de `src/lib/notificacoes.ts`
- Timezone padrão: America/Sao_Paulo
- Estados de loading e estados vazios em todas as páginas — use `EstadoCarregando` / `EsqueletoTabela` / `EsqueletoCartoes` e `EstadoVazio`
- **Sem travessão (`—`) em texto que o usuário final lê.** Vale para copy de tela, mensagens do `notificar` e o campo `mensagem` da API pública. Use ponto, vírgula ou dois pontos no lugar. Não se aplica a comentários de código, a esta documentação, nem ao `—` que marca campo vazio em tabela (`src/lib/formato.ts`), que é convenção de interface e não redação

### Componentes globais disponíveis

Criados na Etapa 2, para uso em todas as seguintes:

| Componente | Uso |
|---|---|
| `ModalConfirmacaoExclusao` | Toda exclusão. Tem `exigirDigitacao` para os casos irreversíveis — o imóvel |
| `EstadoVazio` | Listas sem registros, com ícone, mensagem e ação sugerida |
| `EstadoCarregando`, `EsqueletoTabela`, `EsqueletoCartoes` | Carregamento |
| `SecaoFormulario`, `Campo` | Blocos de formulário. Ficavam em `componentes/imoveis/` e foram promovidos a globais na Etapa 8, quando cinco telas de fora daquela pasta já os importavam |
| `AlternadorLeadsFunil` | Troca entre as duas visualizações de `crm_imobiliaria` |
| `PlaceholderEtapa` | Telas ainda não construídas |
| `registrarLog` | Trilha de auditoria em `logs_sistema` |
| `notificar` | Toasts de sucesso, erro, aviso e informação |

`notificar.erroDoBanco` exibe a mensagem do Postgres como está quando ela vem de um trigger — conflito de agenda, janela de atendimento, limite de fotos já saem em português e com o contexto certo, melhor do que qualquer texto genérico da interface.

## Documentação do projeto

- `CLAUDE.md` — este arquivo. Contexto, stack, regras de negócio e histórico de construção. Referência principal do Claude Code
- `README.md` — porta de entrada do projeto. O que é, o que faz, como rodar, variáveis de ambiente e índice dos demais documentos
- `BANCO.md` — documentação completa do banco: tabelas, campos, relacionamentos, triggers e o porquê de cada decisão
- `NICHO.md` — guia de personalização do sistema para qualquer imobiliária
- `REPLICACAO.md` — guia de replicação da arquitetura para outros nichos

## Histórico de etapas construídas

- **Etapa 1 — Banco de dados:** criado o schema completo com as tabelas `usuarios`, `api_tokens`, `configuracoes`, `logs_sistema`, `crm_imobiliaria`, `tipos_imovel`, `imoveis`, `imoveis_fotos`, `corretores`, `agendas`, `agendas_horarios`, `agendamentos` e `visualizacoes_site`, além dos 11 triggers, políticas de RLS, Realtime, buckets de storage e seed inicial. Criados também os arquivos `README.md`, `BANCO.md`, `NICHO.md` e `REPLICACAO.md`.
- **Etapa 2 — Estrutura, navegação e login:** criado o projeto React + Vite + TypeScript com Tailwind e primitivos no estilo Shadcn. Sistema de design centralizado em `src/index.css`, com a cor de destaque como ponto único de troca. Autenticação via Supabase Auth com contexto global, rota protegida com estado de carregamento e persistência de sessão. Layout do painel com sidebar agrupada, recolhível e responsiva, header com menu do usuário, e layout separado para a vitrine. Todas as 11 rotas registradas, com placeholders e duas páginas 404. Contexto de configurações com Realtime no painel e leitura anônima no site. Componentes globais, utilitário `registrarLog`, favicon e título de aba dinâmico. Adicionada a migration `…013` incluindo `configuracoes` na publicação de Realtime.
- **Etapa 4 — Corretores e Agenda:** página de Corretores em cards, com a cor do corretor em destaque, resumo da janela em linguagem natural e contagem de visitas próximas. Modal de cadastro com paleta fechada de cores (bloqueando as já usadas) e editor da janela de atendimento por dia da semana, com replicação de horário entre dias. Agenda com três visões — semana, dia por corretor e mês —, blocos na cor do responsável, hachura nas canceladas e linha do horário atual. As canceladas passaram depois a ficar **fora da grade por padrão**, alcançáveis pelo filtro de status: ver "A grade da Agenda esconde as canceladas". Criação de visita por clique no slot vazio, com busca de lead e imóvel, cadastro rápido de lead por upsert e sinalização de disponibilidade por corretor antes de salvar. Arrastar reagenda, e na visão de dia também troca o corretor. Detalhe com cancelar, reabrir, marcar como realizada e excluir. Realtime em `agendamentos` com destaque de entrada e aviso quando a visita vem do agente de IA. Conversão de fuso própria em `src/lib/datas.ts`.
- **Etapa 7 — Dashboard:** página inicial do painel com seletor de período global na URL (7 dias, 30 dias, este mês, mês passado e personalizado), faixa fixa de quatro indicadores com variação contra o período anterior equivalente, e duas abas — Site e Operação — também refletidas na URL. Aba Site com ranking de mais visualizados, ranking de mais cliques com taxa de conversão por imóvel, páginas mais acessadas (as de imóvel somadas numa linha) e resumo de estoque com rosca por tipo. Aba Operação com séries diárias de leads, atendimentos do agente e visitas, concentração por dia da semana e rosca do funil que leva ao Kanban filtrado. Oito funções de agregação no Postgres (migration `…015`), todas SECURITY INVOKER e fechadas ao anônimo. Gráficos em SVG próprio, carregamento independente por bloco com erro contido, estados vazios com mensagem específica e tela distinta para sistema recém-implantado.
- **Etapa 6 — Site público:** vitrine anônima com cabeçalho e rodapé alimentados pelas Configurações, todos os campos condicionais. Home com foto de primeira dobra configurável, chips de tipo, formulário de busca sobreposto, 24 imóveis com seletor de categorias na URL, "como funciona", perguntas frequentes em `<details>` nativo, chamada final, faixa de números **reais** vindos do banco e a seção "Sobre a imobiliária" com endereço, contatos e mapa embutido em duas colunas. Listagem com finalidade como primeiro nível de navegação, filtros combináveis na URL, ordenação, carregar mais e dois estados vazios distintos. Página do imóvel por código, com galeria (carrossel no celular, miniaturas no desktop, tela cheia com teclado), valores identificados, características, diferenciais, localização sem endereço exato e semelhantes. Botão de WhatsApp com o código na mensagem, fixo na base no celular, com o clique registrado sem bloquear a navegação. Rastreamento próprio em `visualizacoes_site` com sessão anônima, ignorando acessos da equipe. Fotos redimensionadas pelo Storage com queda para a original. Migration `…014` adicionando `configuracoes.foto_hero_url`.
- **Etapa 5 — Leads e Funil:** página de Leads em tabela, com colunas ordenáveis, busca por nome, WhatsApp e código do imóvel, filtros combináveis (status em seleção múltipla, origem, tipo, finalidade e período) e teto de exibição anunciado em tela. Página de Funil em Kanban com as sete etapas, cards compactos, arrastar entre colunas com atualização otimista e reversão em caso de falha, paginação por coluna com contagem real no cabeçalho e rolagem horizontal no mobile. Ficha do lead em painel lateral compartilhado pelas duas telas, com identificação, interesse, seção do agente de IA exibida só quando houver dados, histórico de visitas, observações editáveis, e troca de etapa. Havia também um link para a conversa no Chatwoot, removido depois: ver "O painel não exibe nada do Chatwoot". Cadastro manual em modal curto, com o WhatsApp como único campo obrigatório e duplicidade tratada oferecendo o cadastro existente. Realtime em `crm_imobiliaria` movendo os cards sozinhos, com pulso de destaque e sem disparar no que a própria aba acabou de gravar. Sete cores de etapa adicionadas ao `index.css`, `tempoRelativo` em `src/lib/datas.ts` e agendamento a partir da ficha via `/painel/agenda?lead=`.
- **Etapa 9 — API pública:** Edge Function única `api` com roteamento interno e os endpoints de atendimento — busca de imóveis por código ou por características, com relaxamento de filtro, listagem de ativos e inativos, disponibilidade, agendar, reagendar, cancelar, consulta de visitas e lead por WhatsApp. `GET /corretores` entrou depois, para o fluxo do N8N descobrir o `id_corretor` e o `id_agenda` de cada um: ver "A lista de corretores é para o fluxo, não para a conversa". Havia também um `GET /imobiliaria`, removido depois: os dados da imobiliária passaram para a view `info_imob_agente`, lida direto pelo N8N. Autenticação por `Authorization: Bearer`, validada em `fn_api_autenticar` (migration `…017`), que numa chamada só confere o token, conta a requisição na janela do minuto e marca `ultimo_uso`; limite de requisições por token com contador em `api_uso`, porque contador em memória não sobrevive a Edge Function efêmera e multi-instância. Mensagens em português conversacional, prontas para o agente repassar, com os horários alternativos escritos dentro da própria mensagem em vez de num campo `alternativas`. Payload mínimo nos endpoints de agenda, com `data_hora` acrescentado depois em `agendar` e `reagendar`. Os status HTTP foram revistos depois também: recusa de negócio passou a sair em 200, ver "O status HTTP diz se a requisição funcionou, não se deu certo". Cálculo de disponibilidade consolidando todos os corretores ativos, com distinção entre `horario_ocupado` e `fora_da_janela` e escolha do corretor livre menos carregado. Toda chamada registrada em `logs_sistema` com o consumidor identificado, e as escritas usando os mesmos nomes de ação do painel para que a linha do tempo do agendamento não se parta em duas. Documentação completa dos endpoints na aba API, com exemplos `curl` já preenchidos com a URL da instalação e o token escolhido na lista. Categoria `api` adicionada a `fn_log_categoria`.
- **Etapa 8 — Configurações:** página com quatro abas na URL — Dados da imobiliária, Tipos de imóvel, API e Logs. Aba de Dados com identidade (nome, logo sem recompressão, foto do hero comprimida no cliente), endereço com busca por CEP, contato com o WhatsApp em destaque, presença digital e fuso horário, cada seção indicando se aquele dado vai para o painel, o site ou a API. O horário de atendimento (migration `…023`) entrou depois, ao lado do fuso: ver "Horário de atendimento não é janela de visita". Bloco de prontidão listando o que falta para publicar, com atalho para resolver cada item, que some quando tudo está resolvido. Aviso de alterações não salvas na saída da página **e na troca de aba**. Aba de Tipos com contagem de uso agregada no banco, reordenação por arrastar gravando em `ordem`, ativação e exclusão traduzindo o RESTRICT da FK em sugestão de desativar. Aba de API com geração de token de 32 bytes, exibição em destaque na criação, mascaramento na lista com cópia do valor completo, revogação reversível e o espaço reservado da documentação da Etapa 9 — com o valor do token **nunca** entrando em `logs_sistema`. Aba de Logs somente leitura, com ação em linguagem natural, busca que alcança o conteúdo do `jsonb`, filtros por tipo de ação, área, usuário e período, paginação com total real e painel lateral comparando antes e depois. Migration `…016` com `fn_log_categoria`, `fn_logs_listar` e `fn_logs_filtros`, todas SECURITY INVOKER e fechadas ao anônimo. `SecaoFormulario` movido de `componentes/imoveis/` para `componentes/`.
- **Etapa 3 — Imóveis:** listagem em grade de cards com alternador para lista compacta, filtros combináveis sincronizados com a URL e três estados distintos (carregando, sem cadastro, sem resultado). Ações de editar, ver no site, copiar link, desativar/reativar e excluir. Cadastro e edição em página própria, com seis seções, busca de endereço por CEP, máscara de moeda, contadores de cômodos, diferenciais livres e aviso de saída sem salvar. Galeria com arrastar e soltar, compressão no cliente para WEBP, reordenação, capa única e limite de 10 fotos. Modal de desativação distinto do de exclusão, e exclusão definitiva exigindo a digitação do código, com aviso das visitas agendadas. Roteador migrado para `createBrowserRouter`.

## Próximos passos

- Etapa 10 — Auditoria de segurança
- Etapa 11 — Deploy seguro para o GitHub
- **Depois de apontar o N8N para `/imoveis/buscar`, apagar as duas rotas herdadas** (`GET /imoveis/codigo/:codigo` e `POST /imoveis/codigos`) do roteador e os dois handlers de `api/imoveis.ts`. Elas já saíram do catálogo e continuam respondendo só para o fluxo em produção não quebrar no deploy da fusão
- **No dia do deploy, preencher o endereço do site em Configurações → Dados.** Enquanto `configuracoes.url_site` estiver vazia, a API devolve `url` nula em toda ficha de imóvel e o agente atende sem nunca mandar o link das fotos. Não dá erro em lugar nenhum, que é o que torna fácil esquecer
- **Antes de divulgar o site, limpar o seed de demonstração.** As migrations `…018` e `…019` colocaram 30 imóveis fictícios no banco — 20 apartamentos na capital e 10 chácaras e sítios no interior —, com endereços inventados e fotos de banco de imagens, e todos já aparecem na vitrine. Saem com `delete from public.imoveis where id::text like 'a5e10000-%' or id::text like 'a5e20000-%';` — ver README.md, "As migrations 018 e 019 são opcionais"

## Integrações

- **Agente de IA no WhatsApp** — em operação. Identifica o imóvel pelo código, busca por características, consulta disponibilidade e opera agendamentos pela API pública; grava e atualiza leads escrevendo direto nas tabelas pelo N8N
- **Chatwoot** — os campos `id_conta_chatwoot`, `id_conversa_chatwoot`, `id_lead_chatwoot` e `inbox_id_chatwoot` existem em `crm_imobiliaria` e são gravados pelo N8N. **O painel não exibe nada disso**, e não deve voltar a exibir: ver "O painel não exibe nada do Chatwoot". Uma integração com a API do Chatwoot, se vier, é do lado das Edge Functions
- **API pública** — Supabase Edge Function `api`, autenticada por token validado em `api_tokens`

### A API pública

Base: `https://<projeto>.supabase.co/functions/v1/api`. Código em `supabase/functions/api/`, com os módulos compartilhados em `supabase/functions/_compartilhado/`. O catálogo exibido em Configurações → API vive em `src/lib/endpointsApi.ts` — **ao mexer num endpoint, atualize os dois.**

Todo endpoint exige `Authorization: Bearer <token>`. A validação é de `fn_api_autenticar` (migration `…017`), que numa chamada só confere o token, conta a requisição na janela do minuto e marca `ultimo_uso`.

| Método | Caminho | Para que serve |
|---|---|---|
| POST | `/imoveis/buscar` | **O endpoint de imóveis.** Com `codigos`, ficha completa por código; sem, filtros combináveis com **alternativas** quando nada corresponde |
| GET | `/imoveis/ativos` | Carteira disponível, paginada |
| GET | `/imoveis/inativos` | Fora do anúncio. Uso interno, não de atendimento |
| POST | `/agenda/disponibilidade` | Com hora: livre ou não. Sem hora: opções do dia |
| POST | `/agenda/agendar` | Marca a visita e cria o lead se não existir |
| POST | `/agenda/reagendar` | Move a visita, sempre por id |
| POST | `/agenda/cancelar` | Cancela, sempre por id |
| GET | `/agenda/visitas` | Lista com o **id** — é como o agente descobre qual visita cancelar |
| GET | `/corretores` | Equipe ativa, com `id_corretor` e `id_agenda`. Para o fluxo, não para a conversa |
| GET | `/leads/:whatsapp` | Lead e histórico de visitas. Somente leitura |

**Não existe endpoint de imóveis excluídos, e não deve existir.** A exclusão é definitiva: o registro saiu do banco e não há de onde lê-lo.

**Não existe mais endpoint de dados da imobiliária.** O `GET /imobiliaria` foi removido: o agente lê a view `info_imob_agente` direto pelo N8N, que é uma consulta em vez de uma requisição autenticada com limite por minuto. Mantê-lo significaria a mesma frase montada em dois lugares, e a primeira divergência apareceu no dia em que a view nasceu. **Não recrie esse endpoint** sem antes decidir qual dos dois é a fonte.

### A lista de corretores é para o fluxo, não para a conversa

`GET /corretores` devolve a equipe ativa com `id_corretor`, `id_agenda` e a janela de atendimento de cada um. Código em `supabase/functions/api/corretores.ts`.

**Ele não muda quem conduz a visita.** Corretor é livre, e quem escolhe continua sendo `/agenda/agendar`, que pega o livre menos carregado. Passar a lista ao cliente transformaria uma escolha do sistema numa pergunta que ele não tem como responder, e é por isso que `/agenda/disponibilidade` nunca recebeu nem devolveu corretor. O que o endpoint resolve são os dois identificadores que o N8N precisa ter antes de existir conversa: o **`id_corretor`**, que é o filtro de `GET /agenda/visitas` e o campo opcional de `agendar` e `reagendar`, e o **`id_agenda`**, que não é usado por endpoint nenhum da API e existe para o fluxo que lê ou escreve `agendas_horarios` direto na tabela.

Três decisões dentro dele:

- **WhatsApp, e-mail e CRECI ficam fora da seleção.** É dado pessoal de funcionário, e o destino da resposta é a conversa de um agente com um cliente. Vale a mesma regra de `CAMPOS_COMPLETO`: a Edge Function roda com service role, o RLS não limita coluna, e a lista de colunas é a única proteção que sobra
- **`agendas.duracao_slot` também fica fora**, por outro motivo: quem gera os blocos é `DURACAO_VISITA`, do ambiente. Devolver a coluna prometeria um número que o cálculo não consulta, e a divergência só apareceria quando alguém a editasse esperando que a agenda mudasse
- **Inativo só sai com `?incluir_inativos=true`.** Ele não recebe visita, e oferecê-lo ao agente faria o agendamento ser recusado pelo banco sem que a conversa entendesse por quê

A frase de `atende` é montada em dois lugares — `resumirJanela` aqui e a de mesmo nome em `src/lib/corretores.ts`, que alimenta o cartão do painel. Duplicação consciente, pela mesma razão do horário de funcionamento: **mexeu numa, confira a outra**, porque duas frases diferentes para a mesma janela fazem quem confere o painel duvidar do que o agente respondeu.

### Toda ficha de imóvel sai com o código e com o link da página

`fichaCompleta` e `fichaResumida`, em `supabase/functions/_compartilhado/imoveis.ts`, começam por `codigo` e `url`. Como toda resposta de imóvel passa por uma das duas, o par aparece em todas, inclusive nas `alternativas` do relaxamento da busca e nas duas rotas herdadas. E os dois campos vão também **dentro da `mensagem`**, que é a frase que o agente repassa ao cliente sem reescrever.

Os dois resolvem pontas opostas da mesma conversa. O **código** é o que amarra o atendimento ao imóvel: chega na primeira mensagem por `mensagemDeInteresse` e é por ele que o agente consulta, agenda e cancela. A **URL** é o que volta para o cliente, porque a pergunta seguinte é quase sempre pelas fotos, e descrever foto por texto não substitui vê-la.

**A URL é montada aqui, nunca deixada a cargo do agente.** Um endereço inventado por um modelo é indistinguível de um endereço certo até alguém tocar nele, e quem descobre o erro é o cliente.

Quatro decisões dentro disso:

- **A base vem de `configuracoes.url_site`** (migration `…021`), lida por `urlDoSite` em `_compartilhado/configuracoes.ts`. Não é a coluna `site`, que é o site institucional da imobiliária: reaproveitá-la faria o agente mandar o link do site antigo, ou do Instagram, dizendo que é a página do imóvel
- **Imóvel que não está ativo sai com `url` nula.** A vitrine só publica ativos, então o endereço de um imóvel desativado cai na 404 pública. Link quebrado é pior do que link nenhum: a conversa passa a ser sobre ele. Vale para `/imoveis/inativos` inteiro
- **Sem `url_site` preenchida, `url` é nula em tudo** e a mensagem simplesmente não menciona link. É o estado antes do deploy, e não quebra nada
- **A frase termina no link, e nada vem depois.** Ponto final colado numa URL é engolido pelo endereço em vários clientes de mensagem, e o link chega quebrado exatamente onde ele mais importa

**Com mais de um imóvel, a mensagem passa a ter uma linha por imóvel** (`listaDeImoveis`), em vez da lista corrida separada por vírgula. Com um endereço no fim de cada frase, a lista corrida vira um parágrafo em que os links se encostam nas vírgulas e nenhuma opção se distingue da seguinte. Pela mesma razão `montarMensagem` junta as partes com quebra de linha e não com espaço.

**Uma limitação conhecida, e ela é de publicação.** O link funciona ao ser tocado, mas a **prévia** dele no WhatsApp sai sem foto e sem título: o ImobFlow é uma SPA, e o robô de prévia lê o HTML cru sem executar JavaScript. Ver "Prévia do link compartilhado tem um limite conhecido". Fecha na Etapa 11.

### Um endpoint só de imóveis, e duas rotas herdadas ainda respondendo

`POST /imoveis/buscar` atende os dois caminhos. Com `codigos` no corpo responde por código; sem, procura por características.

**Eram três rotas, e a escolha entre elas era do agente.** `GET /imoveis/codigo/:codigo`, `POST /imoveis/codigos` e `POST /imoveis/buscar` respondiam à mesma pergunta do cliente, "me fala desse imóvel", e diferiam só por onde ele tinha chegado. Escolha de rota é decisão que um modelo erra sem que ninguém perceba, porque o sintoma não é erro, é resposta pior. Hoje ele manda o que tem e a API decide.

**O detalhe da ficha muda conforme a entrada, e é proposital.** Por código vem a completa, com descrição, características e todas as fotos, no teto de cinco. Por características vem o resumo, paginado. Vinte fichas completas entupiriam o contexto do agente, e quem pede lista quer escolher, não ler tudo. Para um consumidor tipado isso seria um defeito; para um modelo, não é: ele lê `dados[]` do mesmo jeito, e todo item traz `codigo` e `url`.

**Código manda sobre filtro.** Chegando os dois preenchidos, o código é atendido e os filtros são ignorados: o código já identifica o imóvel.

**`codigos` vazio conta como ausente**, e é o que permite ao agente ter um schema só. No N8N o corpo é montado uma vez, com todos os campos, e o modelo preenche o que sabe: sem código, `codigos` chega como `""`, `null` ou `[]`. Recusar essas três formas faria toda busca por características falhar num fluxo que sempre manda o mesmo corpo, e o erro apareceria só em produção, na primeira pessoa que chegasse sem citar imóvel.

Vazio **e** sem filtro nenhum devolve a carteira paginada, que é o que um corpo vazio já devolvia. Recusar aí faria o mesmo pedido ter duas respostas conforme o campo viesse ausente ou em branco, o que ninguém consegue adivinhar.

A contrapartida está registrada porque é o modo de falhar deste desenho: **código velho preso no fluxo mata os filtros em silêncio.** A pessoa pede "casa em Moema até 500 mil", o corpo vai com o `codigos` da conversa anterior, e ela recebe a ficha do imóvel antigo sem erro nenhum. Foi decidido **não avisar na `mensagem`**, e a disciplina de limpar o campo a cada busca fica no prompt do agente.

Quatro coisas que vieram da forma de lista e continuam valendo:

- **`disponivel` mora dentro de cada item**, porque é por imóvel
- **Código inexistente não derruba a chamada.** Os encontrados voltam, os que faltaram vão em `nao_encontrados` e a mensagem diz quais foram
- **O teto é de cinco**, e passar dele é aviso, não erro
- **A resposta é sempre lista**, mesmo com um código só. Endpoint que devolve objeto com um e lista com dois passa no teste e quebra no dia em que o cliente cita dois imóveis

**`GET /imoveis/codigo/:codigo` e `POST /imoveis/codigos` continuam respondendo, fora do catálogo.** Elas estão em produção: apagá-las junto com a fusão quebraria o atendimento no segundo do deploy, antes de o fluxo do N8N poder ser ajustado. Saíram do índice de `/` e da aba API, porque um catálogo que anuncia três formas de fazer a mesma coisa devolve ao agente exatamente a escolha que a fusão existiu para tirar dele. **Saem do código quando o N8N estiver apontando só para `/imoveis/buscar`.** O `GET` mantém o contrato antigo de propósito, devolvendo um objeto com `disponivel` do lado de fora: alinhá-lo agora seria a mesma quebra, só mais difícil de enxergar.

`normalizarCodigo` aceita `IMV0001`, `imv-0001`, `imv 1` e `IMV-1`, completando o zero à esquerda porque é assim que o trigger 2 gera. **O prefixo é lido do que veio, nunca escrito na função:** ele vira `VEI` numa concessionária, e um `'IMV-'` fixo ali só apareceria na primeira replicação.

### O total da busca é o do resultado, não o da página

`POST /imoveis/buscar` devolve `total` ao lado de `dados`, e a `mensagem` anuncia o total: *"Encontrei 18 imóveis. Estes são os 5 primeiros:"*.

Antes ela dizia "Encontrei 5 imóveis", que era o tamanho da página. Numa carteira com dezoito compatíveis, o cliente concluía que só existia aquilo e parava de perguntar, e ninguém tinha como notar: a frase estava correta sobre o que voltou e errada sobre o que existe. O `count` vem na mesma requisição do PostgREST, então não custa uma consulta a mais.

### A busca é tolerante porque quem digita nela é um modelo

`POST /imoveis/buscar` aceita variação de escrita em `finalidade`, `tipo_imovel`, `cidade` e `bairro`. O agente escreve `sitio` e `Sítio`, `apto` e `apartamento`, `sao paulo` e `São Paulo`, e nenhuma dessas diferenças muda o resultado.

**A tolerância vive só nesse lado.** O painel e a vitrine continuam estritos de propósito: lá quem digita é uma pessoa vendo a lista na tela, e adivinhar o que ela quis dizer atrapalha mais do que ajuda. `supabase/functions/_compartilhado/texto.ts` é o único lugar que normaliza.

**Sem acento é a parte que mais importa, e a que falha calada.** `ilike` no Postgres ignora maiúscula, não ignora acento. Sem normalizar, `sitio` não acha "Sítio", `chacara` não acha "Chácara" e `sao paulo` não acha nenhum imóvel da capital. A resposta não é erro, é lista vazia, indistinguível de "não temos nada assim". A comparação acontece em memória, contra os tipos cadastrados e contra as cidades e bairros que existem na carteira, e a consulta filtra por valor exato. Custa uma consulta a mais por busca, só quando o filtro veio.

Quatro decisões dentro disso:

- **`APELIDOS_TIPO` não substitui a lista de tipos.** Ele só resolve abreviação e plural que não são substring do nome cadastrado, porque `apto` não está contido em "Apartamento". O casamento final é sempre contra `tipos_imovel`, que a imobiliária edita no painel: tipo renomeado continua funcionando
- **`ambos` na busca significa não filtrar**, e não é o mesmo que o valor `ambos` da coluna, que é atributo do imóvel e já entra nas duas buscas
- **Finalidade irreconhecível derruba a busca com erro** listando o que vale, em vez de ser ignorada. Ignorar devolveria imóvel de venda para quem quer alugar, sem ninguém perceber que o filtro caiu
- **Sem finalidade, o valor é comparado contra venda OU aluguel.** Fixar em `valor_venda` excluiria todo imóvel só de aluguel, cujo valor de venda é nulo, e "alugar ou comprar até 3 mil" voltaria vazio

Cidade e bairro aceitam vários separados por vírgula. As frases do relaxamento concordam em número ("nos bairros Moema, Itaim e Tatuapé"), porque elas vão inteiras para o cliente no WhatsApp. **Não existe busca por zona**, e não é esquecimento: não há coluna de zona, e deduzi-la do nome do bairro exigiria uma tabela fixa que serviria a uma cidade só.

### A `mensagem` é lida por uma pessoa

Toda resposta traz `sucesso` e `mensagem`. **O campo `mensagem` é repassado pelo agente ao cliente no WhatsApp** — é uma frase que alguém vai ler no celular, não texto de log. "Esse horário já foi preenchido, tenho 15h ou 16h", nunca "Erro: conflito na tabela agendamentos".

O campo `erro` é o oposto: código curto e estável, para o N8N tratar num switch sem comparar texto. Os dois convivem porque atendem leitores diferentes.

**Nos endpoints de agenda o payload é mínimo** — `sucesso`, `id_agendamento` e `mensagem`. Devolver a ficha do agendamento, do lead e do imóvel gastaria contexto do agente à toa e aumentaria a chance de ele reformular em cima de um dado que já veio pronto.

A exceção é `agendar` e `reagendar`, que devolvem também **`data_hora`**, e o motivo é outro leitor: o instante gravado é o único dado da resposta de que o **fluxo do N8N** precisa em forma de campo, para criar evento em calendário ou disparar lembrete. Tirá-lo da `mensagem` com expressão regular funcionaria até a frase mudar, e a frase é escrita para ser lida por uma pessoa, então ela muda. Em `reagendar` a necessidade é mais forte ainda, porque o que mudou foi justamente o horário e o evento já existe em algum lugar.

Sai por `timestampNoFuso`, de `_compartilhado/datas.ts`, em **ISO 8601 com o deslocamento do fuso de `configuracoes`**: `2026-08-24T15:00:00-03:00`.

Duas decisões dentro disso:

- **Um campo só, não `data` + `hora` separados.** Quem consome é um nó de calendário ou de espera, e todos pedem um instante. Dois campos empurram a concatenação para o consumidor, que é trabalho que ele não deveria ter e um lugar a mais para errar
- **Com deslocamento, nunca em UTC** (`…T18:00:00Z`). Os dois descrevem o mesmo instante, mas só o primeiro preserva a hora de parede legível dentro da própria string. Em UTC, qualquer leitura que não converta de volta mostra 18h para uma visita das 15h, e o erro só aparece quando alguém chega três horas atrasado

`cancelar` continua sem o campo: não há horário novo para gravar.

**`GET /agenda/visitas` chama o seu de `data`**, e o formato é o mesmo (`2026-08-13T15:00:00-03:00`, vindo direto do `timestamptz`). A divergência é só de nome, e está registrada aqui porque um consumidor que é modelo de linguagem paga por ela: `data_hora` num endpoint e `data` noutro, para a mesma coisa, é uma escolha a mais para errar. Alinhar os dois é mudança de contrato num campo que já está em produção.

### O status HTTP diz se a requisição funcionou, não se deu certo

**Recusa de negócio sai em `200` com `sucesso: false`.** Horário ocupado, fora da janela, imóvel inexistente, lead desconhecido: a requisição foi bem formada, autenticada e processada, e a resposta certa para ela é "não". Só falha de verdade sai com status de erro, e são cinco: `nao_autorizado` e `token_invalido` em 401, `limite_excedido` em 429, `rota_desconhecida` em 404 e `erro_interno` em 500.

**O motivo é o consumidor real desta API.** O nó HTTP do N8N trata status fora do 2xx como exceção: descarta o corpo e entrega no lugar um `error.message` montado por ele, no formato `400 - "{\"sucesso\":false,\"mensagem\":\"…\"}"`. A frase continua lá, escapada dentro de uma string, e o agente teria que desembrulhar JSON de dentro de texto para achar o que ia repassar ao cliente. Uma frase escrita para ser lida por uma pessoa chegando assim é a frase perdida.

O precedente já existia e é o que fecha o argumento: **`POST /agenda/disponibilidade` sempre respondeu 200 com `disponivel: false`** para o mesmo horário ocupado. Era `agendar` que discordava, e a mesma informação chegava legível por um endpoint e embrulhada pelo outro.

A régua fica em `STATUS_DE_TRANSPORTE`, em `_compartilhado/respostas.ts`, e **`erro()` não aceita mais status por parâmetro**: ele é derivado do código. Passado à mão, a mesma condição acabaria 404 num endpoint e 200 noutro conforme quem escreveu a linha. **Código novo não escolhe status, escolhe o `CodigoErro`** — e um código novo que não esteja no mapa sai em 200 por padrão, que é o certo para o caso comum.

Duas consequências a conhecer:

- **`parametro_invalido` também sai em 200**, e isso significa que um mapeamento quebrado no N8N não aparece como vermelho na lista de execuções. Foi decidido assim porque a alternativa reintroduz o mesmo defeito por outra porta: o agente que esquece o WhatsApp receberia "Preciso do WhatsApp com DDD para marcar a visita" embrulhada, e não conseguiria pedir o dado ao cliente. Quem denuncia esse caso é o campo `erro` e a trilha em `logs_sistema`
- **No fluxo, ramifique por `sucesso` e `erro`, nunca pelo ramo de erro do nó.** Recusas que antes caíam no Error Branch agora chegam no Success Branch

**Não existe campo `alternativas` nas respostas de agenda.** Os horários próximos vão escritos por extenso dentro da própria `mensagem`, entre dois e três. Uma lista de ISO 8601 obrigaria o agente a formatar data em português, que é onde aparece "quinta-feira, 32 de agosto".

### Os triggers continuam sendo a fonte de verdade

A regra da Etapa 4 vale igual para as Edge Functions, e é a mais fácil de violar por engano ao escrever um endpoint:

- **Agendar não atualiza o lead.** O trigger 8 move para `agendou`.
- **Cancelar não rebaixa o lead.** O trigger decide, e só rebaixa para `cancelou` se não restar outra visita agendada.
- **Conflito e janela são validados pelo banco**, triggers 4 e 5. O cálculo de disponibilidade da API é antecipação, não autoridade: entre calcular e gravar existe uma janela em que outra conversa pode ter ocupado o horário. Quando o banco recusa, `respostaDeTrigger` traduz a recusa para uma frase de conversa com as alternativas dentro.

**Não replique nada disso na Edge Function.** Duas fontes de verdade divergem no primeiro caso de borda, e o caso de borda aqui é um cliente com duas visitas marcadas.

### O que a API NÃO faz, e por quê

**A API não expõe escrita em leads.** Criar, atualizar e mudar o status do lead é o agente escrevendo direto nas tabelas pelo N8N. A única exceção é o upsert por WhatsApp dentro de `/agenda/agendar`, que existe porque não faz sentido recusar um agendamento por falta de cadastro prévio.

**Isso é decisão arquitetural consciente, e tem consequências que a Etapa 10 precisa considerar:**

- O agente opera com a **service role key**, que ignora todo o RLS. Essa credencial vive fora do backend, dentro do fluxo N8N, com acesso irrestrito ao banco
- Ela nunca pode aparecer em log, em captura de tela de fluxo ou em repositório
- **Escritas diretas do agente não passam por `logs_sistema`**, ao contrário das operações via API. A rastreabilidade dessas ações depende do histórico do próprio N8N
- Qualquer erro no fluxo tem potencial de afetar qualquer tabela, não só as de lead
- Recomenda-se restringir o fluxo do agente a escrever apenas em `crm_imobiliaria`, **por disciplina de construção** — a credencial não impõe essa restrição tecnicamente

### `verify_jwt` desligado não é brecha

`supabase/config.toml` declara `verify_jwt = false` para a função `api`, e precisa. Com ele ligado, o gateway do Supabase exigiria um JWT do Supabase Auth no `Authorization` — e o que vai ali é o token do ImobFlow. Desligar não abre a porta: transfere a tranca do gateway para `autenticar()`, a primeira coisa que roda em toda requisição, inclusive antes de reconhecer a rota.

Rota inexistente **sem** token responde 401, não 404. A lista de endpoints válidos é informação, e não há razão para entregá-la a quem não tem credencial.

### A service role key torna a lista de colunas a única proteção

Na vitrine, o RLS ao menos limitava a linha (ver "O endereço exato não vai para a vitrine"). **Na Edge Function não limita nada** — o `service_role` passa por cima de toda política.

`CAMPOS_COMPLETO` e `CAMPOS_RESUMO`, em `supabase/functions/_compartilhado/imoveis.ts`, não incluem `proprietario_nome`, `proprietario_contato`, `cep`, `endereco`, `numero` nem `complemento`. Um `select('*')` ali entregaria o telefone do dono e o endereço exato dentro do WhatsApp de qualquer pessoa que perguntasse pelo imóvel.
