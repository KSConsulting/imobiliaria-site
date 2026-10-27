# NICHO.md — Personalizando o ImobFlow para uma nova imobiliária

## 1. O que este documento é

Este é o guia para colocar o ImobFlow no ar para **outra imobiliária**, trocando identidade, dados e vocabulário sem tocar em uma linha da arquitetura — nenhuma tabela nova, nenhum trigger alterado, nenhum deploy de schema.

Para adaptar a arquitetura a **outro tipo de negócio** — concessionária, clínica, escola — o documento é outro: [REPLICACAO.md](REPLICACAO.md).

---

## 2. O que trocar em Configurações

A tabela `configuracoes` é **registro único** e alimenta o site público e a API **ao mesmo tempo**. Isso é o ponto central: não existe "o telefone do site" e "o telefone do sistema". Trocar o WhatsApp aqui muda o número que recebe os cliques da vitrine e, na mesma operação, o número que a API devolve ao agente de IA. Um lugar, dois destinos.

| Campo | O que é | Onde aparece |
|---|---|---|
| `nome_negocio` | Nome da imobiliária | Cabeçalho e rodapé do site, título da aba, painel |
| `logo_url` | URL da logo no bucket `logos` | Cabeçalho do site e do painel |
| `endereco`, `cep`, `cidade`, `estado` | Endereço físico | Rodapé do site, página de contato |
| `telefone` | Telefone fixo | Rodapé do site |
| `whatsapp` | **Número que recebe os cliques do site** | Botão de WhatsApp de cada imóvel |
| `email` | Email de contato | Rodapé do site |
| `site` | Site institucional, se houver outro | **Não aparece na vitrine.** Só na frase que o agente de IA lê, pela view `info_imob_agente` |
| `url_site` | **Endereço onde a vitrine está publicada** | Só a API: é dele que sai o link de cada imóvel que o agente manda ao cliente |
| `instagram` | Perfil do Instagram | Rodapé, ícone social |
| `link_google_maps` | Link do mapa | "Como chegar" da página do imóvel, e a frase do agente de IA. **O mapa do rodapé e o da home não saem daqui**, e sim do endereço |
| `horario_funcionamento` | Horário de atendimento ao público, por dia da semana | Seção "Sobre a imobiliária" da home, e a frase que o agente de IA lê. **Não define os horários de visita**, que vêm da agenda de cada corretor |
| `fuso_horario` | Fuso da operação | **Base das validações de agenda.** Mantenha `America/Sao_Paulo` salvo se a imobiliária operar em outro fuso |

Tudo isso é editado pelo painel, em **Configurações → Dados da imobiliária**. Nenhum desses campos exige deploy: salvar já muda a vitrine, porque site, painel e API leem a mesma linha da mesma tabela.

A tela exibe, ao lado de cada seção, **para onde aqueles dados vão** — painel, site público ou API. Vale a pena olhar antes de preencher: sem essa indicação o formulário parece cadastro interno, e o erro daí é invisível nos dois sentidos. Ou se publica o número pessoal na vitrine achando que era anotação da equipe, ou se deixa o WhatsApp vazio por cautela e o site fica sem o único botão que gera contato.

> ⚠️ `fuso_horario` não é decorativo. Os triggers de conflito de horário e de janela de atendimento convertem os horários das visitas usando esse valor. Trocá-lo desloca a interpretação de toda a agenda. O seletor da tela oferece os fusos do Brasil pelo nome pelo qual as pessoas os conhecem, e avisa quando o computador de quem está olhando está em outro fuso.

> ⚠️ `url_site` e `site` **não são o mesmo campo**. `site` é o site institucional que a imobiliária talvez já tenha, e hoje não é exibido na vitrine: sai só na frase que o agente de IA repassa. `url_site` é o endereço desta vitrine, e serve para a API montar o link da página de cada imóvel. Vazio, o agente atende normalmente e nunca manda link nenhum, sem gerar erro em lugar algum. Preencha no dia em que o site for ao ar.

### O bloco de prontidão diz quando dá para publicar

No topo da aba de Dados aparece um bloco listando **o que ainda falta para o site poder ser divulgado**, com atalho para resolver cada item:

| Item | O que quebra sem ele |
|---|---|
| Nome da imobiliária | Cabeçalho do site e título da aba saem com o nome do sistema |
| WhatsApp de atendimento | O botão principal da vitrine **não aparece** |
| Logo cadastrada | Cabeçalho, rodapé e login exibem apenas o nome em texto |
| Ao menos um imóvel ativo | A vitrine abre vazia |

Os quatro têm em comum o fato de que, faltando, **o site abre normalmente e não funciona**. É o pior tipo de falha numa implantação, porque não gera erro nenhum — só um cliente que não chega.

**O bloco some quando não falta mais nada.** Se ele desapareceu, a imobiliária está pronta para publicar o link. Se reaparecer depois (alguém apagou a logo, o último imóvel foi desativado), volta a ocupar o topo da tela.

---

## 3. Identidade visual

### Cores — um arquivo, quatro linhas

Todo o sistema de design vive em **`src/index.css`**. A cor de destaque está no primeiro bloco do arquivo, sob o comentário *"COR DE DESTAQUE — ponto único de troca por imobiliária"*:

```css
/* src/index.css */
:root {
  --cor-destaque: oklch(0.705 0.187 47);            /* a cor da marca */
  --cor-destaque-hover: oklch(0.646 0.194 41);      /* um pouco mais escura */
  --cor-destaque-contraste: oklch(0.145 0 0);       /* texto SOBRE a cor */
  --cor-destaque-suave: color-mix(in oklab, var(--cor-destaque) 14%, transparent);
}
```

Trocar essas linhas muda de uma vez: botões, links, item ativo da sidebar, anel de foco dos campos, o brilho da coluna visual do login, os feixes e os destaques da vitrine. **Nas duas áreas ao mesmo tempo.** A `--cor-destaque-suave` se ajusta sozinha, porque é a própria cor com transparência.

O sistema é escuro (tema Lumina). Isso pede duas atenções na troca:

- **A cor da marca precisa ter luz** sobre preto: luminosidade entre 0,62 e 0,80 no primeiro número do `oklch`. Uma marca escura, como azul-marinho ou vinho, deve ser clareada para virar destaque; a versão escura dela some sobre o fundo
- **`--cor-destaque-contraste` é o texto sobre a cor.** Ele é escuro porque o laranja é claro. Se a marca clareada ainda pedir texto branco (um azul médio, por exemplo), troque por `oklch(0.985 0 0)`

A barra lateral **não** deriva da marca: é um preto neutro, e a marca aparece no marcador e no ícone do item ativo. Não há nada a ajustar nela.

Os valores são **oklch**, no formato `oklch(luminosidade croma matiz)`. Exemplos de matiz: azul ≈ 250, terracota ≈ 40, vinho ≈ 15, verde-água ≈ 190, verde ≈ 155.

Os neutros ficam logo abaixo, no bloco seguinte do mesmo arquivo. É uma escala neutra sobre quase preto, e é raro precisar mexer nela.

**Não sobrescreva cor componente a componente.** É assim que a identidade se perde: seis meses depois, metade do sistema ignora a variável e a troca deixa de funcionar.

### Tipografia — dois lugares

1. **`src/index.css`**, dentro do bloco `@theme inline`, na variável `--font-sans`
2. **`index.html`**, no `<link>` do Google Fonts que carrega a fonte

Troque nos dois. Só no CSS, a fonte não carrega; só no HTML, o sistema não a usa.

Padrão do ImobFlow: **Inter** — uma família só, sem serifa, com boa variação de peso.

### Formas

Também em `src/index.css`: `--raio` (0.75rem) controla o arredondamento de cards, botões e campos. As três sombras (`--shadow-cartao`, `--shadow-elevado`, `--shadow-sobreposto`) ficam no bloco `@theme`.

### Assets

- **Logo:** suba no bucket `logos` pelo painel, em Configurações. O sistema grava a URL pública em `configuracoes.logo_url`. Não coloque a logo em `public/` — assim ela fica trocável sem deploy.
- **Favicon e imagem de compartilhamento (OG image):** ficam em `public/`, e trocá-los exige novo build.
- **Fotos dos imóveis:** bucket `imoveis`, enviadas pelo painel no cadastro de cada imóvel.

### Cor do corretor

Cada corretor tem sua própria cor (`corretores.cor`, hexadecimal), usada para distinguir as visitas na Agenda. Não vem do tema — é dado, escolhido no cadastro de cada um.

---

## 3b. Onde mudar os textos do site

O site público tem duas categorias de texto, e elas mudam em lugares diferentes.

**O que vem das Configurações e muda pelo painel, sem deploy:** nome, logo, telefone, WhatsApp, email, endereço, CEP e Instagram alimentam cabeçalho, rodapé e a seção "Sobre a imobiliária" da home. O link do Google Maps aparece na página do imóvel, e o site institucional só na resposta do agente de IA — ver a tabela da seção 2, que diz o destino de cada um. Todo campo é condicional — o que não estiver preenchido simplesmente não aparece, em vez de virar um rótulo com valor vazio.

**O endereço tem uma exigência a mais que os outros campos.** O mapa embutido só aparece com **rua e cidade** preenchidas. Faltando uma das duas, o mapa some e o endereço continua em texto: um mapa montado só com a cidade apontaria para o centro do município e responderia "onde estamos" com um lugar onde a imobiliária não está.

**O que é texto fixo e mora em um arquivo só:** `src/componentes/publico/textos.ts`.

| Constante | Onde aparece | O que é |
|---|---|---|
| `HERO` | Primeira dobra da home | Título e subtítulo |
| `PASSOS` | Seção "Como funciona" | Os três passos até a visita: ícone, título e uma linha |
| `PERGUNTAS` | Perguntas frequentes | Perguntas e respostas do acordeão |
| `CHAMADA_FINAL` | Faixa antes do rodapé | Título e uma linha de apoio |
| `SOBRE` | Seção "Sobre a imobiliária", no fim da home | Título e a frase de apresentação. **Endereço, telefone e email não estão aqui**: vêm das Configurações, e o mapa ao lado é montado a partir do endereço |

Estão todos num arquivo só de propósito: personalizar o site é a tarefa mais frequente da implantação, e ninguém deveria precisar caçar frase dentro de JSX para fazer isso.

**A tela de login não está nesse arquivo, e não precisa estar.** O nome da imobiliária ali vem das Configurações, como em todo o resto: salvou o nome novo, o login mostra o nome novo. O que é fixo é a coluna verde à esquerda, com quatro cartões que nomeiam as áreas do painel (carteira de imóveis, agenda de visitas, funil de atendimento e vitrine no ar). Esse texto descreve o **sistema**, não a imobiliária, e por isso serve igual em qualquer implantação. Se ainda assim quiser mexer, a lista está em `AREAS`, no topo de `src/paginas/Login.tsx`.

**Ao reescrever as perguntas frequentes, cuidado com um detalhe.** As respostas que vêm no padrão são genéricas por decisão: nenhuma cita prazo, taxa ou percentual. É aí que o texto padrão vira informação errada na mão do cliente — uma resposta dizendo "análise em 48 horas" numa imobiliária que leva uma semana gera reclamação com razão. Se for citar número, cite o número daquela imobiliária.

**O que não existe e não deve ser criado:** seção de depoimentos e faixa de "mais de X famílias atendidas" com conteúdo inventado. A home tem uma faixa de números, mas ela puxa dados reais do banco — imóveis disponíveis, quantos à venda, quantos para alugar e cidades atendidas — e **não é renderizada quando não há imóvel cadastrado**. Número inventado destrói confiança exatamente onde ela deveria ser construída, e uma imobiliária recém-implantada não tem histórico nenhum para exibir.

### A foto de fundo da primeira dobra

Três níveis, nesta ordem de preferência:

1. **`configuracoes.foto_hero_url`** — a escolha explícita da imobiliária, enviada pelo painel em **Configurações → Dados da imobiliária → Identidade**. É o caminho recomendado: uma foto de fachada ou aérea da região funciona melhor do que a foto de um imóvel que pode ser vendido amanhã. A imagem é reduzida para 1920px e convertida em WEBP no navegador antes de subir, então pode enviar a foto do celular como ela está.
2. **A capa do imóvel em destaque** — quando a coluna acima está vazia, o site usa a foto de capa do imóvel ativo mais recente. Funciona bem no primeiro dia, sem ninguém configurar nada. O efeito colateral a conhecer: **a foto da home muda sozinha** a cada imóvel novo cadastrado.
3. **Fundo sólido na cor de destaque** — quando não há nem imóvel com foto. É o caso da imobiliária que acabou de entrar no ar, e existe para que a home nunca apareça com um retângulo vazio, que é a pior primeira impressão possível.

A mesma foto é reaproveitada na faixa de chamada final, antes do rodapé.

> A **logo** sobe sem recompressão, e a foto do hero sobe comprimida. A diferença é deliberada: logo é traço reto e texto, exatamente onde o artefato de compressão com perda aparece, e um SVG precisa continuar SVG. A foto do hero é uma fotografia exibida em largura total, e vem do celular com 4 a 12 MB — acima do limite de 5 MB do bucket. Ali a compressão não é otimização, é o que faz o upload caber.

### A mensagem do WhatsApp

Montada em `src/lib/whatsapp.ts`, por `mensagemDeInteresse`:

```
Olá! Tenho interesse no imóvel IMV-0042.
```

Mudar a frase é seguro — cada imobiliária tem seu tom. **Tirar o código não é.** É ele que permite ao agente de IA responder sobre aquele imóvel já na primeira resposta, e é ele que liga o clique ao imóvel no rastreamento. Reescreva a frase mantendo `${codigo}` dentro dela.

---

## 4. Tipos de imóvel

A lista de categorias vive na tabela **`tipos_imovel`** e é editada pelo painel. Não é `enum`, não é lista fixa em código — de propósito.

O motivo é que o vocabulário do mercado muda com a região, e quem sabe o vocabulário certo é a imobiliária, não o desenvolvedor:

- **Imobiliária de praia** costuma precisar de *flat*, *frente-mar*, *apart-hotel*
- **Imobiliária de interior** costuma precisar de *fazenda*, *haras*, *rancho*
- **Imobiliária de capital** costuma precisar de *loft*, *studio*, *duplex*

O seed inicial traz onze tipos que cobrem o caso geral: casa, apartamento, terreno, chácara, sítio, comercial, galpão, cobertura, kitnet, fazenda, sobrado.

**Como ajustar**, tudo em **Configurações → Tipos de imóvel**:

- **Adicionar** — botão "Novo tipo". O nome duplicado é recusado antes de chegar ao banco, e de novo pelo banco, porque entre digitar e salvar outra aba pode ter criado o mesmo nome.
- **Reordenar** — arraste pela alça. A ordem definida ali **é a ordem exibida nos filtros do site e nos atalhos da home**, então coloque na frente o que a imobiliária mais vende.
- **Ocultar** — o interruptor da linha. O tipo some dos cadastros novos e dos filtros do site, e **os imóveis que já o usam continuam publicados e funcionando**. É a saída certa para "esse tipo não usamos mais".
- **Excluir** — só é possível se **nenhum** imóvel usa o tipo, e a lista mostra a contagem em cada linha para você saber antes de tentar. A FK com `ON DELETE RESTRICT` bloqueia o resto, e a tela traduz a recusa dizendo quantos imóveis dependem dele. Não é uma limitação a contornar: sem o RESTRICT, apagar "Apartamento" apagaria em cascata todos os apartamentos do estoque.

---

## 5. O que no cadastro de imóvel é brasileiro e o que é universal

Esta seção não interessa para trocar de imobiliária dentro do Brasil — ali tudo se aplica. Ela existe para quem for **levar o ImobFlow para outro país**, e para deixar registrado onde estão as amarras ao mercado brasileiro antes que alguém as descubra do jeito difícil.

### Específicos do mercado brasileiro

| Campo | Por que é local | O que fazer fora do Brasil |
|---|---|---|
| `cep` | Formato de 8 dígitos com máscara `00000-000`, e a busca automática usa o **ViaCEP**, serviço brasileiro | Trocar a máscara em `mascararCep` e substituir `src/lib/cep.ts` pelo serviço de código postal local |
| `estado` | Lista fechada das **27 UFs**, em `ESTADOS_BRASIL` (`src/lib/formato.ts`) | Trocar pela divisão administrativa local, ou virar campo de texto livre |
| `valor_iptu` | **IPTU** é o imposto predial municipal brasileiro | Renomear para o imposto equivalente (`property_tax`, `taxe foncière`) ou remover |
| `valor_condominio` | Taxa de **condomínio** no formato brasileiro, mensal e por unidade | Equivale a *HOA fee*, *service charge*, *charges de copropriété* — o conceito existe, o nome não |
| `creci` (em `corretores`) | Registro profissional do corretor no Brasil | Trocar pelo registro local, ou remover |
| Moeda | Formatação fixa em **BRL / pt-BR**, em `src/lib/formato.ts` | Trocar `currency` e o `locale` nas três funções de moeda |
| `bairro` | **Obrigatório** porque no Brasil o bairro é o principal critério de busca | Em países onde a busca é por código postal ou distrito, pode virar opcional — mas então revise o índice `idx_imoveis_bairro` |

### Universais

Servem a qualquer mercado imobiliário, sem tradução:

`titulo` · `descricao` · `finalidade` · `status` · `endereco` · `numero` · `complemento` · `cidade` · `valor_venda` · `valor_aluguel` · `area_total` · `area_util` · `quartos` · `suites` · `banheiros` · `vagas` · `mobiliado` · `aceita_pet` · `caracteristicas` · `proprietario_nome` · `proprietario_contato` · os dois contadores

O `caracteristicas` em `jsonb` é o amortecedor: tudo que é diferencial listável e não precisa de filtro estruturado cabe nele sem coluna nova. Foi feito assim justamente para que a adaptação regional não vire migração de schema.

### Uma amarra que não é campo

A **área em metros quadrados** está no rótulo (`m²`) e na formatação, não no dado. Em mercado que trabalha com pés quadrados, a conversão é de exibição — o número no banco continua sendo o que a imobiliária digitou, na unidade que ela usa. Decida a unidade uma vez, na implantação, e não misture as duas na mesma base.

---

## 6. Dados do proprietário nunca são públicos

`proprietario_nome` e `proprietario_contato` existem para uso interno da imobiliária. Eles **não aparecem no site público e não podem aparecer em nenhum endpoint público da API**, nem por descuido de um `select *`.

Não é preferência de layout: é o telefone de um terceiro que confiou o imóvel à imobiliária. Vazá-lo na vitrine entrega o contato do dono direto para quem quiser pular a intermediação — e, dependendo do caso, é problema de LGPD.

A política de RLS permite leitura anônima da tabela `imoveis` inteira quando `status = 'ativo'`, então **a proteção precisa estar na consulta**: o site público e os endpoints da API devem listar as colunas explicitamente, sem `select('*')`. Isso vale a partir da Etapa 6 e é obrigatório na Etapa 9.

---

## 7. Corretores e janelas de atendimento

### Cadastrando a equipe

Cada corretor precisa de nome, sobrenome e uma **cor de destaque** em hexadecimal — é ela que separa visualmente as visitas na Agenda. WhatsApp, email e CRECI são opcionais mas recomendados.

No momento em que o corretor é salvo, o banco cria sozinho:

1. A **agenda** dele, com bloco de visita de 30 minutos
2. A **janela padrão**: segunda a sexta, das 09:00 às 18:00

Isso não é conveniência, é proteção. Corretor sem nenhuma janela cadastrada faz a API responder "sem disponibilidade" para todos os horários, e nada no sistema aponta o motivo — o dono conclui que a agenda está cheia. Nascer com uma janela sensata torna o erro visível em vez de silencioso.

### Por que a janela é individual

Porque corretor não é recurso homogêneo. Um atende de manhã, outro só à tarde, outro trabalha sábado e folga na segunda. Uma configuração global de horário comercial forçaria todo mundo para o mesmo molde, e cada exceção viraria regra codificada na aplicação.

Com a janela por corretor e por dia da semana (`agendas_horarios`), a disponibilidade real do time é **dado**, ajustável pelo painel a qualquer momento, sem deploy. O agente de IA lê essa mesma tabela ao consultar disponibilidade, então o que o dono configura é exatamente o que o agente oferece ao cliente.

**Ajustando após o cadastro:** em Corretores, ao editar o corretor, a seção "Janela de atendimento" traz uma linha por dia da semana. Dias sem janela ativa ficam indisponíveis — é assim que se configura folga. O botão "Copiar para os demais" replica o horário de um dia nos outros dias ativos, para não obrigar a preencher cinco vezes o mesmo intervalo.

### Onde mudar o padrão de segunda a sexta, 9h às 18h

Esse horário é apenas um **valor inicial**, e existe para que o corretor não nasça sem nenhuma disponibilidade — sem ele, a API responderia "sem horários" e ninguém entenderia o motivo. Ele vive em **dois lugares**, que precisam continuar iguais:

| Onde | O quê |
|---|---|
| `supabase/migrations/…007_funcoes_e_triggers.sql` | O trigger `fn_criar_agenda_corretor`: o laço `for v_dia in 1..5` e o `time '09:00'` / `time '18:00'` |
| `src/componentes/corretores/ModalCorretor.tsx` | A função `janelaPadraoNova()`, que espelha o trigger para exibir a janela no formulário antes de salvar |

Alterar só o trigger faz o formulário mostrar um horário e o banco gravar outro. Alterar só o formulário faz o corretor cadastrado pela API nascer com o horário antigo.

**Para uma imobiliária com rotina diferente** — de praia, que abre sábado e domingo na alta temporada; de plantão, que atende até 20h — mude os dois e reaplique a migration. Vale só para corretores cadastrados **a partir dali**: os que já existem mantêm a janela que têm, e o ajuste deles é pelo painel, corretor a corretor.

Se a diferença for de um ou dois corretores apenas, não mexa no padrão. Ajuste pelo painel.

---

## 8. O que nunca deve ser alterado

Estas regras são a diferença entre um sistema que funciona sozinho e um que precisa de alguém consertando dados toda semana. Todas estão no banco, e é lá que devem continuar.

| Regra | Por que existe |
|---|---|
| **`whatsapp` UNIQUE em `crm_imobiliaria`** | É o que permite ao agente de IA operar por upsert numa única operação atômica. Sem isso ele precisa "buscar e criar", e duas mensagens simultâneas do mesmo contato viram dois leads. |
| **Exclusão de imóvel é definitiva** | Sem exclusão lógica, toda consulta do painel, do site e da API para de depender de um filtro `where excluido = false` que alguém, em algum lugar, um dia vai esquecer — e um imóvel vendido reaparece na vitrine. |
| **Trigger de conflito de horário** | É o único ponto por onde passam painel e agente de IA ao mesmo tempo. Validar só na aplicação deixa exatamente a corrida entre os dois sem cobertura, e o corretor acaba em dois lugares no mesmo horário. |
| **Trigger de janela de atendimento** | Impede visita marcada às 7h ou no domingo porque o agente de IA não conhecia a agenda do time. A janela é dado; a validação garante que o dado seja respeitado por qualquer caminho de escrita. |
| **Criação automática da agenda do corretor** | Corretor sem agenda não é erro visível: a API só responde "sem disponibilidade" e ninguém entende o motivo. Nascer com agenda e janela padrão elimina a classe inteira de bug silencioso. |
| **Cópia de `codigo_imovel` em `agendamentos`** | Como o imóvel some do banco de verdade, é essa cópia que mantém o histórico legível. Sem ela, a visita realizada em um imóvel já vendido vira um registro que não diz o que foi visitado. |

Também não mexa em: `ON DELETE RESTRICT` de `imoveis.id_tipo_imovel` (protege o cadastro de perder a categoria) e `ON DELETE RESTRICT` de `agendamentos.id_corretor` (impede visita órfã — para tirar um corretor de circulação, use `ativo = false`).

---

## 9. Checklist de implantação

Do zero ao primeiro imóvel publicado. **A ordem importa**: cada bloco depende do anterior, e pular etapa aqui produz retrabalho — o caso mais comum é cadastrar trinta imóveis antes de acertar os tipos e ter que reclassificar todos depois.

Do passo 6 em diante, **quase tudo acontece dentro do painel**. Continuam fora dele apenas três pontos: a cor da marca e os textos do site, que pedem editor, e a publicação da Edge Function da API, no passo 29, que pede terminal.

### Banco e acesso

1. **Criar o projeto no Supabase** — escolha a região mais próxima dos clientes (`sa-east-1` para Brasil)
2. **Aplicar as migrations** de [supabase/migrations/](supabase/migrations/) **em ordem numérica**, via `supabase db push` ou pelo SQL Editor
3. **Conferir o schema** — 13 tabelas, RLS ativo em todas, buckets `logos` e `imoveis` criados
4. **Criar o primeiro usuário** em *Authentication → Users*, com email e senha. O registro em `public.usuarios` aparece sozinho, pelo trigger
5. **Fazer o primeiro login** no painel e confirmar que o nome exibido no canto superior está correto

### Dados da imobiliária — `Configurações → Dados da imobiliária`

O bloco no topo da aba vai listar o que falta. Ele é o roteiro desta seção: quando sumir, os passos 6 a 10 estão feitos.

6. **Nome da imobiliária.** Aparece na sidebar, no cabeçalho do site, no título da aba e na API. É o único campo obrigatório da tela
7. **Logo.** Botão "Enviar", em Identidade. Fundo transparente e proporção horizontal funcionam melhor — ela é exibida em faixa, ao lado do nome. PNG, JPEG, WEBP ou SVG, até 5 MB, sem recompressão
8. **WhatsApp de atendimento.** É o campo mais consequente da tela inteira: **é este número que recebe todos os cliques do site**. Errado ou vazio, a vitrine continua registrando cliques que não chegam a lugar nenhum, e o Dashboard mostra atividade que nunca virou conversa
9. **Endereço, telefone, e-mail, redes e link do mapa.** Todos opcionais — campo vazio simplesmente não renderiza no rodapé do site. O CEP preenche endereço, cidade e estado sozinho
10. **Horário de atendimento e fuso horário**, as duas seções do fim da aba.

    O **horário de atendimento** é um intervalo por dia, sem pausa de almoço. É o que o agente responde a "vocês abrem sábado?" e o que aparece na seção Sobre da home. **Ele não define horário de visita:** isso continua vindo da janela de cada corretor. Deixe para preencher **depois de cadastrar os corretores**, porque a tela avisa quando o horário declarado é maior do que a equipe consegue cobrir, e sem corretor cadastrado não há com o que comparar.

    O **fuso horário** é `America/Sao_Paulo` salvo exceção. Confira antes de cadastrar corretor: é este valor que a agenda usa para validar conflito e janela de atendimento
11. **Foto de fundo da home** (opcional). Sem ela, a home usa a capa do imóvel em destaque, e sem imóvel usa o fundo sólido na cor de destaque
12. **Salvar.** A sidebar e o site público refletem na hora, sem republicar nada

### Identidade visual — no código

13. **Aplicar a cor da marca** — as linhas de `--cor-destaque` em `src/index.css`, conferindo o contraste do texto sobre ela (ver seção 3)
14. **Trocar a fonte**, se a marca exigir — `src/index.css` + `index.html`

### Vocabulário — `Configurações → Tipos de imóvel`

15. **Revisar a lista** antes de cadastrar qualquer imóvel. Desative o que não se aplica, crie o que falta na região. Fazer isso agora custa cinco minutos; fazer depois é reclassificar a carteira inteira
16. **Arrastar para ordenar.** A ordem daqui é a ordem dos filtros do site — coloque na frente o que a imobiliária mais vende

### Equipe — `Corretores`

17. **Cadastrar os corretores**, cada um com sua cor. A agenda de cada um é criada sozinha, com a janela padrão de segunda a sexta, das 9h às 18h
18. **Ajustar as janelas** de quem não segue esse padrão. É a janela que define os horários que a API vai oferecer ao agente de IA
19. **Testar um agendamento** pelo painel e conferir que ele aparece na Agenda com a cor certa

### Textos do site — no código

20. **Revisar `src/componentes/publico/textos.ts`** — hero, "como funciona", perguntas frequentes e chamada final (ver seção 3b). Os textos padrão são genéricos de propósito e funcionam, mas é aqui que a vitrine deixa de parecer um modelo

### Carteira e publicação

21. **Cadastrar o primeiro imóvel** — o código `IMV-XXXX` é gerado sozinho, nunca digitado
22. **Subir as fotos** (até 10) e marcar a capa
23. **Conferir a vitrine** — o imóvel aparece no site imediatamente, sem publicação manual
24. **Conferir o rodapé** — cada campo preenchido no passo 9 virou um item; os vazios não aparecem
25. **Testar o botão de WhatsApp** na página do imóvel e confirmar que a mensagem chega **com o código do imóvel dentro**. É essa frase que permite ao agente responder sobre aquele imóvel já na primeira resposta
26. **Testar desativação e reativação** — desative, confirme que sumiu do site, reative e confirme que voltou íntegro
27. **Abrir a vitrine numa janela anônima** — é assim que o cliente vê. Serve também para conferir o rastreamento: acesso com sessão do painel não é contado
28. **Voltar a Configurações e confirmar que o bloco de prontidão sumiu.** Se sumiu, o link pode ser divulgado

### Integrações — `Configurações → API` (a partir da Etapa 9)

29. **Publicar a Edge Function da API**, com `npx supabase login` e depois `npx supabase functions deploy api --project-ref <ref-do-projeto>`. É o único passo desta seção que não acontece no painel, e o único de toda a implantação que **falha sem dar erro**: sem ele o painel abre, a vitrine publica, os imóveis aparecem e o site pode ser divulgado, mas toda chamada do agente responde `NOT_FOUND` e a suspeita recai sobre o fluxo do N8N, que está certo. Confirme antes de seguir, com o `curl` da seção 4 do README: a resposta certa é `nao_autorizado`, não `NOT_FOUND`
30. **Gerar o token** com um nome que identifique o consumidor — "Agente WhatsApp", "Integração portal". Um por consumidor: é o que permite revogar um sem derrubar o outro. **Copie no momento da criação**, que é quando ele precisa ir para a automação
31. **Configurar o agente de IA** com esse token e o endpoint da API
32. **Testar o fluxo completo:** mensagem no WhatsApp → lead criado → visita agendada → card se movendo sozinho no Kanban do painel
33. **Conferir em `Configurações → Logs`** que as ações do agente aparecem na trilha, com o nome do consumidor
