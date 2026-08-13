/**
 * Catálogo dos endpoints da API pública.
 *
 * Este arquivo é a fonte da documentação exibida em Configurações → API,
 * e existe para que **quem monta o fluxo no N8N não precise abrir o
 * código da Edge Function**. Ao criar ou mudar um endpoint em
 * `supabase/functions/api/`, atualize aqui junto — documentação que
 * envelhece silenciosamente é pior do que documentação ausente, porque
 * ninguém desconfia dela.
 */

export type GrupoEndpoint = 'imoveis' | 'agenda' | 'leads'

export interface ParametroEndpoint {
  nome: string
  tipo: string
  obrigatorio: boolean
  descricao: string
}

/**
 * Uma forma de chamar o endpoint.
 *
 * Existe para o `/imoveis/buscar`, que atende duas perguntas diferentes
 * com o mesmo caminho. Um exemplo só ali obrigaria quem monta o fluxo a
 * deduzir a outra forma a partir da tabela de parâmetros — e deduzir
 * corpo de requisição é onde nasce o erro que só aparece em produção.
 */
export interface ExemploChamada {
  rotulo: string
  /** Quando usar essa forma, e o que esperar de volta. */
  nota?: string
  corpo: Record<string, unknown>
}

export interface Endpoint {
  grupo: GrupoEndpoint
  metodo: 'GET' | 'POST'
  /** Caminho relativo à base, com `:parametro` quando houver. */
  caminho: string
  titulo: string
  /** Para que serve na conversa real, não o que faz tecnicamente. */
  proposito: string
  parametros: ParametroEndpoint[]
  /** Corpo de exemplo, para os POST de uma forma só. */
  corpoExemplo?: Record<string, unknown>
  /** Mais de uma forma de chamada. Quando presente, ignora `corpoExemplo`. */
  exemplos?: ExemploChamada[]
  /** Caminho já preenchido, para o exemplo de chamada. */
  caminhoExemplo: string
  resposta: string
}

export const GRUPOS: { chave: GrupoEndpoint; rotulo: string; resumo: string }[] = [
  {
    chave: 'imoveis',
    rotulo: 'Imóveis',
    resumo: 'Identificar o imóvel do link e procurar por características.',
  },
  {
    chave: 'agenda',
    rotulo: 'Agenda',
    resumo: 'Consultar horários e operar visitas. Payload mínimo em todos.',
  },
  { chave: 'leads', rotulo: 'Leads', resumo: 'Somente leitura. A escrita é direta na tabela.' },
]

export const ENDPOINTS: Endpoint[] = [
  /* ------------------------------------------------------ imóveis --- */
  {
    grupo: 'imoveis',
    metodo: 'POST',
    caminho: '/imoveis/buscar',
    caminhoExemplo: '/imoveis/buscar',
    titulo: 'Buscar imóveis, com código ou por características',
    proposito:
      'O endpoint de imóveis. Com "codigos" no corpo, responde por código e devolve a ficha completa. Sem eles, procura pelas características e devolve o resumo. É a mesma pergunta do cliente nos dois casos, e a diferença é só por onde ele chegou: com o código do link do site, ou descrevendo o que quer. Quando nada corresponde à busca, devolve alternativas em vez de lista vazia, porque lista vazia encerra o atendimento.',
    parametros: [
      { nome: 'codigos', tipo: 'texto ou lista', obrigatorio: false, descricao: 'Um ou vários códigos. Texto com vírgulas ("IMV-0001, IMV-0007") ou array. Aceita sem hífen, minúsculas e sem o zero à esquerda: IMV0001, imv-0001 e IMV-1 chegam todos no mesmo imóvel. Repetidos contam uma vez. Máximo 5 por chamada; o excedente vira aviso na mensagem, não erro. Preenchido, manda sobre todos os filtros abaixo. Vazio, nulo ou lista vazia conta como ausente, e aí valem os filtros: é o que permite o fluxo mandar sempre o mesmo corpo.' },
      { nome: 'codigo', tipo: 'texto ou lista', obrigatorio: false, descricao: 'Apelido de "codigos", para quando o fluxo já manda no singular.' },
      { nome: 'finalidade', tipo: 'texto', obrigatorio: false, descricao: 'venda, locacao ou ambos. Aceita comprar, vender, alugar, aluguel e acento. "ambos" não filtra. Valor irreconhecível devolve erro dizendo o que vale.' },
      { nome: 'tipo_imovel', tipo: 'texto', obrigatorio: false, descricao: 'Nome do tipo, com ou sem acento, e apelidos: apto, ap, kit, sala. Vários por vírgula: "apto, casa". Tipo que não existe é ignorado se houver outro válido.' },
      { nome: 'cidade', tipo: 'texto', obrigatorio: false, descricao: 'Busca parcial, com ou sem acento: "sao paulo" acha "São Paulo". Não aceita sigla.' },
      { nome: 'bairro', tipo: 'texto', obrigatorio: false, descricao: 'Busca parcial, com ou sem acento. Vários por vírgula: "moema, itaim, tatuape".' },
      { nome: 'valor_max', tipo: 'número', obrigatorio: false, descricao: 'Teto do orçamento. É o campo da qualificação: "quanto pretende investir" vira valor_max. Comparado com o valor da finalidade pedida; sem finalidade, vale a venda OU o aluguel.' },
      { nome: 'valor_min', tipo: 'número', obrigatorio: false, descricao: 'Piso, para quando a pessoa der uma faixa. Independente do valor_max: pode mandar um, o outro, os dois ou nenhum.' },
      { nome: 'quartos_min', tipo: 'número', obrigatorio: false, descricao: 'Mínimo de quartos.' },
      { nome: 'banheiros_min', tipo: 'número', obrigatorio: false, descricao: 'Mínimo de banheiros.' },
      { nome: 'vagas_min', tipo: 'número', obrigatorio: false, descricao: 'Mínimo de vagas.' },
      { nome: 'area_min', tipo: 'número', obrigatorio: false, descricao: 'Área útil mínima, em m².' },
      { nome: 'mobiliado', tipo: 'booleano', obrigatorio: false, descricao: 'true ou false.' },
      { nome: 'aceita_pet', tipo: 'booleano', obrigatorio: false, descricao: 'true ou false.' },
      { nome: 'limite', tipo: 'número', obrigatorio: false, descricao: 'Quantos imóveis por resposta. Padrão 5, máximo 20.' },
      { nome: 'pagina', tipo: 'número', obrigatorio: false, descricao: 'Começa em 0. Use para pedir os próximos.' },
    ],
    // Um exemplo só, com **todos** os campos aceitos, e não os campos de
    // uma chamada típica. É o corpo que o nó do N8N monta uma vez: o
    // agente preenche o que sabe e deixa o resto vazio. Dois exemplos
    // aqui devolveriam ao leitor a pergunta de qual dos dois configurar,
    // quando o nó é um só.
    exemplos: [
      {
        rotulo: 'Todos os campos aceitos',
        nota: 'Este é o corpo completo, para servir de referência. Todo campo é opcional: mande só o que a conversa deu. Com "codigos" preenchido, os filtros abaixo dele são ignorados; vazio, nulo ou ausente, valem os filtros. Com tudo vazio, devolve a carteira paginada. Copiar assim como está, com todos os filtros ao mesmo tempo, normalmente cai no relaxamento e volta em "alternativas".',
        corpo: {
          codigos: 'IMV-0001, IMV-0007',
          finalidade: 'venda',
          tipo_imovel: 'apartamento, casa',
          cidade: 'São Paulo',
          bairro: 'Moema, Itaim',
          valor_min: 300000,
          valor_max: 900000,
          quartos_min: 3,
          banheiros_min: 2,
          vagas_min: 1,
          area_min: 80,
          mobiliado: false,
          aceita_pet: true,
          limite: 10,
          pagina: 0,
        },
      },
    ],
    resposta: `// UM CORPO SÓ, e o que vem preenchido decide a resposta:
{ "codigos": "IMV-0001, IMV-0007" }           → ficha completa, teto de 5
{ "codigos": "", "cidade": "São Paulo" }      → resumo, paginado
{ "cidade": "São Paulo", "quartos_min": 3 }   → idem, sem o campo

// ---------- Por código ----------
{
  "sucesso": true,
  "dados": [
    { "codigo": "IMV-0001", "url": "https://…/imovel/IMV-0001", "disponivel": true,
      "titulo": "Casa ampla no Jardim Europa", "tipo": "Casa", "finalidade": "venda",
      "bairro": "Jardim Europa", "cidade": "São Paulo", "estado": "SP",
      "valor_venda": 850000, "quartos": 3, "suites": 1, "banheiros": 2, "vagas": 2,
      "area_util": 180, "mobiliado": false, "aceita_pet": true,
      "descricao": "…", "diferenciais": ["Piscina", "Churrasqueira"],
      "foto_capa": "https://…/capa.webp", "fotos": ["https://…/1.webp"] },
    { "codigo": "IMV-0007", "url": null, "disponivel": false, "…": "…" }
  ],
  "nao_encontrados": ["IMV-9999"],
  "mensagem": "Encontrei 2 imóveis:
IMV-0001: Casa no Jardim Europa… Fotos e detalhes: https://…/imovel/IMV-0001
IMV-0007: Apartamento no Itaim…
O IMV-0007 não está mais disponível no momento.
Já IMV-9999 eu não encontrei."
}

// A resposta é SEMPRE lista, mesmo com um código só.
// O "disponivel" fica dentro de cada item, porque é por imóvel.
// Código que não existe não derruba a chamada: os outros voltam.

// ---------- Por características ----------
{
  "sucesso": true,
  "dados": [ { "codigo": "IMV-0001", "url": "https://…/imovel/IMV-0001", "foto_capa": "…" } ],
  "total": 18,
  "pagina": 0,
  "alternativas": [],
  "mensagem": "Encontrei 18 imóveis. Estes são os 5 primeiros:
IMV-0001: Casa no Jardim Europa… Fotos e detalhes: https://…/imovel/IMV-0001
IMV-0002: Casa no Itaim… Fotos e detalhes: https://…/imovel/IMV-0002
…"
}

// "total" é o resultado inteiro, "dados" é a página. A mensagem anuncia
// o total: dizer "encontrei 5" numa carteira com 18 compatíveis faria o
// cliente concluir que só existe isso e parar de perguntar.

// ---------- Sem correspondência exata ----------
{
  "sucesso": true,
  "dados": [],
  "total": 0,
  "alternativas": [ { "codigo": "IMV-0002", "url": "https://…", "…": "…" } ],
  "criterio_relaxado": "bairro",
  "mensagem": "Não achei nenhum imóvel no bairro Itaim, mas tenho estas 2 opções parecidas:
IMV-0002: …"
}

// O "url" é a página do imóvel na vitrine, montada a partir do endereço
// do site em Configurações → Dados. Sem ele preenchido, o campo vem null
// e a mensagem não menciona link. Imóvel fora do anúncio também vem com
// "url": null, porque a vitrine só publica ativos.`,
  },
  {
    grupo: 'imoveis',
    metodo: 'GET',
    caminho: '/imoveis/ativos',
    caminhoExemplo: '/imoveis/ativos?limite=10&pagina=0',
    titulo: 'Listar imóveis ativos',
    proposito: 'A carteira disponível, em formato resumido e paginado.',
    parametros: [
      { nome: 'limite', tipo: 'número', obrigatorio: false, descricao: 'Padrão 5, máximo 20.' },
      { nome: 'pagina', tipo: 'número', obrigatorio: false, descricao: 'Começa em 0.' },
    ],
    resposta: `{ "sucesso": true, "dados": [ … ], "total": 42, "pagina": 0, "limite": 10,
  "mensagem": "São 42 imóveis disponíveis." }

// Cada item traz "codigo" e "url", a página dele na vitrine.`,
  },
  {
    grupo: 'imoveis',
    metodo: 'GET',
    caminho: '/imoveis/inativos',
    caminhoExemplo: '/imoveis/inativos',
    titulo: 'Listar imóveis inativos',
    proposito:
      'Uso interno de sistemas externos — sincronizar um portal, por exemplo. Não use no atendimento: são imóveis fora do anúncio.',
    parametros: [
      { nome: 'limite', tipo: 'número', obrigatorio: false, descricao: 'Padrão 5, máximo 20.' },
      { nome: 'pagina', tipo: 'número', obrigatorio: false, descricao: 'Começa em 0.' },
    ],
    resposta: `{ "sucesso": true, "dados": [ … ], "total": 3, "mensagem": "São 3 imóveis fora do anúncio." }

// Aqui "url" é sempre null: a vitrine só publica imóveis ativos, e o
// endereço de um imóvel fora do anúncio cai na página de não encontrado.`,
  },

  /* ------------------------------------------------------- agenda --- */
  {
    grupo: 'agenda',
    metodo: 'POST',
    caminho: '/agenda/disponibilidade',
    caminhoExemplo: '/agenda/disponibilidade',
    titulo: 'Consultar disponibilidade',
    proposito:
      'Responde as duas perguntas da conversa real. Com data e hora: "dá pra quinta às 15h?". Só com data: "o que você tem na quinta?". Não recebe corretor — a API consolida sozinha.',
    parametros: [
      { nome: 'data', tipo: 'AAAA-MM-DD', obrigatorio: true, descricao: 'O dia consultado.' },
      { nome: 'hora', tipo: 'HH:MM', obrigatorio: false, descricao: 'Com hora, responde sim ou não. Sem hora, lista opções.' },
    ],
    corpoExemplo: { data: '2026-08-24', hora: '15:00' },
    resposta: `{ "sucesso": true, "disponivel": true,
  "mensagem": "Sim, segunda-feira, 24/08, às 15h está livre. Quer que eu confirme?" }

// Ocupado ou fora da janela — os horários próximos vêm NA mensagem:
{ "sucesso": true, "disponivel": false, "motivo": "horario_ocupado",
  "mensagem": "segunda-feira, 24/08, às 15h já está ocupado. Tenho segunda às 14h, segunda às 16h ou terça às 9h. Qual fica melhor pra você?" }

// Só com data:
{ "sucesso": true, "disponivel": true, "horarios": ["9h", "11h", "15h30", "17h30"],
  "mensagem": "Em 24/08 tenho 9h, 11h, 15h30 ou 17h30. Qual prefere?" }`,
  },
  {
    grupo: 'agenda',
    metodo: 'POST',
    caminho: '/agenda/agendar',
    caminhoExemplo: '/agenda/agendar',
    titulo: 'Criar visita',
    proposito:
      'Marca a visita. Cria o lead pelo WhatsApp se ele ainda não existir — não faz sentido recusar um agendamento por falta de cadastro prévio.',
    parametros: [
      { nome: 'whatsapp', tipo: 'texto', obrigatorio: true, descricao: 'Com código do país: 5511971351311. Aceita máscara, e sem o 55 assume Brasil.' },
      { nome: 'data', tipo: 'AAAA-MM-DD', obrigatorio: true, descricao: '' },
      { nome: 'hora', tipo: 'HH:MM', obrigatorio: true, descricao: 'Aceita também "15h".' },
      { nome: 'nome', tipo: 'texto', obrigatorio: false, descricao: 'Gravado no lead quando ele é criado agora.' },
      { nome: 'codigo_imovel', tipo: 'texto', obrigatorio: false, descricao: 'Opcional de propósito — quem chega por indicação marca antes de escolher o imóvel.' },
      { nome: 'id_corretor', tipo: 'uuid', obrigatorio: false, descricao: 'Sem ele, a API escolhe o corretor livre menos carregado.' },
      { nome: 'observacoes', tipo: 'texto', obrigatorio: false, descricao: 'Anotação livre.' },
    ],
    corpoExemplo: {
      whatsapp: '5511971351311',
      nome: 'Maria Silva',
      data: '2026-08-24',
      hora: '15:00',
      codigo_imovel: 'IMV-0001',
    },
    resposta: `{ "sucesso": true, "id_agendamento": "uuid",
  "data_hora": "2026-08-24T15:00:00-03:00",
  "mensagem": "Visita confirmada para segunda-feira, 24/08, às 15h, com Rafael." }

// data_hora é ISO 8601 com o fuso da imobiliária, pronto para um nó de
// calendário. É para o fluxo — quem lê no WhatsApp lê a mensagem.

// Erro — os horários alternativos vêm escritos NA mensagem:
{ "sucesso": false, "erro": "horario_ocupado",
  "mensagem": "segunda-feira, 24/08, às 15h já foi preenchido. Tenho segunda às 14h, segunda às 16h ou terça às 9h. Qual fica melhor pra você?" }`,
  },
  {
    grupo: 'agenda',
    metodo: 'POST',
    caminho: '/agenda/reagendar',
    caminhoExemplo: '/agenda/reagendar',
    titulo: 'Reagendar visita',
    proposito:
      'Move a visita. Sempre pelo id — identificar por data seria ambíguo com o lead que tem mais de uma marcada.',
    parametros: [
      { nome: 'id_agendamento', tipo: 'uuid', obrigatorio: true, descricao: 'Obtido em GET /agenda/visitas.' },
      { nome: 'data', tipo: 'AAAA-MM-DD', obrigatorio: true, descricao: '' },
      { nome: 'hora', tipo: 'HH:MM', obrigatorio: true, descricao: '' },
      { nome: 'id_corretor', tipo: 'uuid', obrigatorio: false, descricao: 'Sem ele, mantém o corretor atual se ele estiver livre.' },
    ],
    corpoExemplo: {
      id_agendamento: '00000000-0000-0000-0000-000000000000',
      data: '2026-08-25',
      hora: '10:00',
    },
    resposta: `{ "sucesso": true, "id_agendamento": "uuid",
  "data_hora": "2026-08-25T10:00:00-03:00",
  "mensagem": "Visita remarcada para terça-feira, 25/08, às 10h, com Rafael." }

// data_hora é o instante novo — é com ele que o fluxo move o evento que
// já estava no calendário.`,
  },
  {
    grupo: 'agenda',
    metodo: 'POST',
    caminho: '/agenda/cancelar',
    caminhoExemplo: '/agenda/cancelar',
    titulo: 'Cancelar visita',
    proposito:
      'Cancela. O reflexo no lead é do banco: ele só volta para "cancelou" quando não restar nenhuma outra visita agendada.',
    parametros: [
      { nome: 'id_agendamento', tipo: 'uuid', obrigatorio: true, descricao: 'Obtido em GET /agenda/visitas.' },
      { nome: 'motivo', tipo: 'texto', obrigatorio: false, descricao: 'Anexado às observações da visita.' },
    ],
    corpoExemplo: {
      id_agendamento: '00000000-0000-0000-0000-000000000000',
      motivo: 'Imprevisto no trabalho',
    },
    resposta: `{ "sucesso": true, "id_agendamento": "uuid",
  "mensagem": "Visita de segunda-feira, 24/08, às 15h cancelada." }`,
  },
  {
    grupo: 'agenda',
    metodo: 'GET',
    caminho: '/agenda/visitas',
    caminhoExemplo: '/agenda/visitas?whatsapp=5511971351311',
    titulo: 'Consultar visitas',
    proposito:
      'O endpoint que resolve "quero cancelar minha visita" sem o cliente dizer qual. O agente consulta, apresenta as opções e usa o id devolvido para cancelar ou remarcar.',
    parametros: [
      { nome: 'whatsapp', tipo: 'texto', obrigatorio: false, descricao: 'Visitas de um contato.' },
      { nome: 'de', tipo: 'AAAA-MM-DD', obrigatorio: false, descricao: 'Início do período.' },
      { nome: 'ate', tipo: 'AAAA-MM-DD', obrigatorio: false, descricao: 'Fim do período, inclusivo.' },
      { nome: 'id_corretor', tipo: 'uuid', obrigatorio: false, descricao: 'Agenda de um corretor.' },
      { nome: 'status', tipo: 'texto', obrigatorio: false, descricao: 'agendada, realizada, cancelada ou reagendada.' },
    ],
    resposta: `{
  "sucesso": true,
  "dados": [
    { "id_agendamento": "uuid",
      "quando": "segunda-feira, 24/08, às 15h",
      "data": "2026-08-24T15:00:00-03:00",
      "status": "agendada",
      "codigo_imovel": "IMV-0001",
      "imovel": "Casa ampla no Jardim Europa",
      "corretor": "Rafael Souza" }
  ],
  "mensagem": "Há uma visita marcada: segunda-feira, 24/08, às 15h."
}`,
  },

  /* -------------------------------------------------------- leads --- */
  {
    grupo: 'leads',
    metodo: 'GET',
    caminho: '/leads/:whatsapp',
    caminhoExemplo: '/leads/11912345678',
    titulo: 'Consultar lead por WhatsApp',
    proposito:
      'Permite retomar uma conversa sabendo o que já aconteceu, em vez de recomeçar o atendimento com quem já visitou dois imóveis na semana passada.',
    parametros: [
      { nome: 'whatsapp', tipo: 'texto na URL', obrigatorio: true, descricao: 'Só números, com código do país. Sem o 55 assume Brasil.' },
    ],
    resposta: `{
  "sucesso": true,
  "dados": {
    "whatsapp": "5511971351311", "nome": "Maria Silva",
    "status": "agendou", "tipo": "lead",
    "codigo_imovel_interesse": "IMV-0001",
    "resumo_conversa": "…",
    "visitas": [ { "id_agendamento": "uuid", "quando": "segunda-feira, 24/08, às 15h", "status": "agendada" } ]
  },
  "mensagem": "Maria Silva já é conhecido, tem visita marcada para segunda-feira, 24/08, às 15h."
}`,
  },
]

/**
 * Códigos de `erro`, para o switch do N8N.
 *
 * O `http` está aqui porque muda o que o fluxo precisa fazer. Os códigos
 * de resposta ao cliente saem em **200 com `sucesso: false`**, e o nó HTTP
 * do N8N os entrega como item normal, com a `mensagem` pronta para o
 * agente repassar. Os de falha real saem com status de erro e fazem o nó
 * lançar exceção, que é o comportamento desejado: ali o fluxo está
 * quebrado e alguém precisa ver.
 */
export const CODIGOS_ERRO: { codigo: string; quando: string; http: number }[] = [
  /* -------------------------------- resposta ao cliente, em 200 ----- */
  { codigo: 'parametro_invalido', quando: 'Faltou um campo obrigatório ou o formato não serve.', http: 200 },
  { codigo: 'imovel_nao_encontrado', quando: 'Código de imóvel inexistente ou já excluído.', http: 200 },
  { codigo: 'lead_nao_encontrado', quando: 'Primeiro contato desse número.', http: 200 },
  { codigo: 'agendamento_nao_encontrado', quando: 'Id de visita inexistente.', http: 200 },
  { codigo: 'horario_ocupado', quando: 'A imobiliária atende, mas o horário está cheio.', http: 200 },
  { codigo: 'fora_da_janela', quando: 'A imobiliária não atende nesse dia ou horário.', http: 200 },
  { codigo: 'sem_corretor_disponivel', quando: 'Nenhum horário livre nos próximos dias.', http: 200 },
  { codigo: 'sem_corretores', quando: 'Nenhum corretor ativo cadastrado.', http: 200 },
  { codigo: 'data_no_passado', quando: 'A data pedida já passou.', http: 200 },

  /* ------------------------------------ falha de verdade, em 4xx/5xx */
  { codigo: 'nao_autorizado', quando: 'Faltou o cabeçalho Authorization.', http: 401 },
  { codigo: 'token_invalido', quando: 'Token inexistente ou revogado.', http: 401 },
  { codigo: 'limite_excedido', quando: 'Excedeu o limite de requisições por minuto.', http: 429 },
  { codigo: 'rota_desconhecida', quando: 'Método ou caminho que não existe na API.', http: 404 },
  { codigo: 'erro_interno', quando: 'Falha inesperada. O detalhe fica nos logs da função.', http: 500 },
]
