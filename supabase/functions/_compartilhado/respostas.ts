/**
 * Formato de resposta da API.
 *
 * **O campo `mensagem` é lido pelo agente e repassado ao cliente final no
 * WhatsApp.** Isso muda tudo sobre como ele é escrito: não é log, não é
 * mensagem de erro de sistema, é uma frase que uma pessoa vai ler no
 * celular. "Esse horário já foi preenchido, tenho 15h ou 16h" — nunca
 * "Erro: conflito de agendamento na tabela agendamentos".
 *
 * O campo `erro` é o oposto: código curto e estável, para o N8N tratar
 * com um switch sem comparar texto. Os dois convivem porque servem a
 * leitores diferentes — um é a máquina, o outro é o cliente.
 */

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(corpo: unknown, status = 200, extras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CABECALHOS, ...extras },
  })
}

export function preflight(): Response {
  return new Response('ok', { headers: CABECALHOS })
}

/** Resposta de consulta: os dados completos e a frase pronta. */
export function sucesso(dados: unknown, mensagem: string, extras: Record<string, unknown> = {}) {
  return json({ sucesso: true, dados, mensagem, ...extras })
}

/**
 * Resposta dos endpoints de agenda: payload mínimo, deliberadamente.
 *
 * Devolver a ficha completa do agendamento, do lead e do imóvel gastaria
 * contexto do agente à toa e aumentaria a chance de ele reformular em
 * cima de um dado que já veio pronto na `mensagem`.
 *
 * `dataHora` é a exceção, e por um motivo diferente: o instante gravado é
 * o único dado da resposta que o **fluxo** precisa em forma de campo.
 * Extrair "quinta-feira, 14/08, às 15h" da `mensagem` com expressão
 * regular no N8N funcionaria até o dia em que a frase mudasse — e a frase
 * é escrita para ser lida por uma pessoa, então ela muda.
 *
 * Vem em ISO 8601 com deslocamento, por `timestampNoFuso`. Um campo só,
 * porque quem consome é um nó de calendário ou de espera, e todos pedem
 * um instante.
 */
export function sucessoAgenda(idAgendamento: string, mensagem: string, dataHora?: string) {
  return json({
    sucesso: true,
    id_agendamento: idAgendamento,
    ...(dataHora ? { data_hora: dataHora } : {}),
    mensagem,
  })
}

export type CodigoErro =
  | 'nao_autorizado'
  | 'token_invalido'
  | 'limite_excedido'
  | 'rota_desconhecida'
  | 'parametro_invalido'
  | 'imovel_nao_encontrado'
  | 'lead_nao_encontrado'
  | 'agendamento_nao_encontrado'
  | 'horario_ocupado'
  | 'fora_da_janela'
  | 'sem_corretor_disponivel'
  | 'sem_corretores'
  | 'data_no_passado'
  | 'erro_interno'

/**
 * Falhas de transporte: a requisição em si não funcionou.
 *
 * **Só o que está aqui sai com status de erro**, e a razão é o consumidor
 * real desta API. O nó HTTP do N8N trata status fora do 2xx como exceção:
 * ele descarta o corpo e entrega no lugar um `error.message` montado por
 * ele mesmo, no formato `400 - "{\"sucesso\":false,…}"`. A `mensagem`
 * continua lá dentro, só que escapada dentro de uma string, e o agente
 * passa a ter que desembrulhar JSON de dentro de texto para achar a
 * frase que ia repassar ao cliente.
 *
 * Por isso a régua não é "deu certo?", é **"a requisição funcionou?"**:
 *
 * - **Status de erro** para o que quebrou de fato, e cuja frase nunca vai
 *   para um cliente: token ausente, token inválido, limite estourado,
 *   rota inexistente, falha interna. Aqui a exceção no N8N é desejada,
 *   porque o fluxo está mesmo quebrado e alguém precisa ver vermelho.
 * - **200 com `sucesso: false`** para o resto. Horário ocupado não é uma
 *   requisição que falhou, é a resposta certa para a pergunta que foi
 *   feita, e ela chega escrita para o cliente ler.
 *
 * O precedente já existia: `POST /agenda/disponibilidade` sempre
 * respondeu 200 com `disponivel: false` para o mesmo horário ocupado. Era
 * `agendar` que discordava, e a mesma informação chegava legível por um
 * endpoint e embrulhada pelo outro.
 *
 * Quem distingue os dois casos continua sendo o campo `erro`, que não
 * mudou e é estável — o switch do N8N olha para ele, nunca para o status.
 */
const STATUS_DE_TRANSPORTE: Partial<Record<CodigoErro, number>> = {
  nao_autorizado: 401,
  token_invalido: 401,
  limite_excedido: 429,
  rota_desconhecida: 404,
  erro_interno: 500,
}

/**
 * O status **não é parâmetro**, de propósito: ele sai do código do erro.
 *
 * Passado à mão, a mesma condição acabaria 404 num endpoint e 200 noutro
 * conforme quem escreveu a linha, e o fluxo do N8N trataria o mesmo
 * `erro` de dois jeitos sem que nada denunciasse a diferença.
 */
export function erro(codigo: CodigoErro, mensagem: string) {
  return json({ sucesso: false, erro: codigo, mensagem }, STATUS_DE_TRANSPORTE[codigo] ?? 200)
}
