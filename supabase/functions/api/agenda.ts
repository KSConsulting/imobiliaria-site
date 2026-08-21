import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { DURACAO_VISITA } from '../_compartilhado/ambiente.ts'
import { erro, json, sucesso, sucessoAgenda } from '../_compartilhado/respostas.ts'
import {
  alternativasProximas,
  blocosLivres,
  corretorMenosCarregado,
  diasSeguintes,
  type Bloco,
  type Dia,
} from '../_compartilhado/disponibilidade.ts'
import {
  curtoFalado,
  dataCurta,
  horaFalada,
  instanteDe,
  lerData,
  lerHora,
  listar,
  porExtenso,
  timestampNoFuso,
} from '../_compartilhado/datas.ts'
import { AcoesApi, AcoesEscrita, registrar } from '../_compartilhado/registro.ts'
import { fusoDaImobiliaria } from '../_compartilhado/configuracoes.ts'
import { normalizarCodigo } from '../_compartilhado/imoveis.ts'
import { normalizarWhatsapp } from '../_compartilhado/telefone.ts'
import type { Consumidor } from '../_compartilhado/autenticacao.ts'

/** Quantos dias à frente procurar alternativas quando o pedido não cabe. */
const JANELA_ALTERNATIVAS = 7

/**
 * A frase de alternativas.
 *
 * **Não existe campo `alternativas` na resposta de erro, de propósito.**
 * Uma lista de ISO 8601 obrigaria o agente a formatar datas em português
 * — e modelo de linguagem formatando data é onde aparece "quinta-feira,
 * 32 de agosto". Aqui a frase já sai pronta para ser repassada sem
 * processamento nenhum.
 */
function fraseAlternativas(blocos: Bloco[], fuso: string): string {
  if (blocos.length === 0) return ''
  return listar(
    blocos.map((bloco) => curtoFalado(bloco.inicio, fuso)),
    'ou',
  )
}

/** Lê `data` e `hora` do corpo, com as mensagens que o cliente vai ler. */
function lerMomento(
  corpo: Record<string, unknown>,
  fuso: string,
  exigirHora: boolean,
): { dia: Dia; minutos: number | null; instante: Date | null } | Response {
  const dia = lerData(corpo.data)
  if (!dia) {
    return erro(
      'parametro_invalido',
      'Preciso da data no formato AAAA-MM-DD, por exemplo 2026-08-14.',
    )
  }

  const bruta = corpo.hora
  if (bruta === undefined || bruta === null || bruta === '') {
    if (exigirHora) {
      return erro('parametro_invalido', 'Preciso também do horário, por exemplo 15:00.')
    }
    return { dia, minutos: null, instante: null }
  }

  const minutos = lerHora(bruta)
  if (minutos === null) {
    return erro('parametro_invalido', 'Não entendi o horário. Use o formato 15:00.')
  }

  const instante = instanteDe(
    dia.ano,
    dia.mes,
    dia.dia,
    Math.floor(minutos / 60),
    minutos % 60,
    fuso,
  )
  return { dia, minutos, instante }
}

/* ------------------------------------------------------------------ */
/* POST /agenda/disponibilidade                                        */
/* ------------------------------------------------------------------ */

/**
 * Atende as duas perguntas que aparecem na conversa real.
 *
 * Com data e hora: "dá pra quinta às 15h?" — resposta sim ou não, e o
 * não já vem com o que dá. Só com data: "o que você tem na quinta?" —
 * resposta com três ou quatro opções, não com as quarenta que existem.
 * Despejar a agenda inteira faz o cliente não escolher nenhuma.
 */
export async function disponibilidade(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  const fuso = await fusoDaImobiliaria(supabase)

  const momento = lerMomento(corpo, fuso, false)
  if (momento instanceof Response) return momento

  const { dia, instante } = momento

  const blocosDoDia = await blocosLivres(supabase, fuso, [dia])

  await registrar(supabase, consumidor, {
    acao: AcoesApi.disponibilidadeConsultada,
    tabela: 'agendamentos',
    dadosNovos: { data: corpo.data, hora: corpo.hora ?? null, livres: blocosDoDia.length },
  })

  /* ------------------------------------------- data + hora --------- */
  if (instante) {
    const exato = blocosDoDia.find((bloco) => bloco.inicio.getTime() === instante.getTime())

    if (exato) {
      return json({
        sucesso: true,
        disponivel: true,
        mensagem: `Sim, ${porExtenso(instante, fuso)} está livre. Quer que eu confirme?`,
      })
    }

    const alternativas = alternativasProximas(
      await blocosLivres(supabase, fuso, diasSeguintes(dia, JANELA_ALTERNATIVAS, fuso)),
      instante,
      3,
    )

    // Mesma distinção do agendamento: "está cheio" e "não atendemos" são
    // respostas diferentes na conversa.
    const naJanela = await blocosLivres(supabase, fuso, [dia], { apenasJanela: true })
    const atende = naJanela.some((b) => b.inicio.getTime() === instante.getTime())

    const abertura = atende
      ? `${porExtenso(instante, fuso)} já está ocupado.`
      : `Não atendemos ${porExtenso(instante, fuso)}.`

    return json({
      sucesso: true,
      disponivel: false,
      motivo: atende ? 'horario_ocupado' : 'fora_da_janela',
      mensagem: alternativas.length
        ? `${abertura} Tenho ${fraseAlternativas(alternativas, fuso)}. Qual fica melhor pra você?`
        : `${abertura} Nos próximos dias também não tenho horário livre. Posso pedir para alguém da equipe falar com você?`,
    })
  }

  /* ------------------------------------------- só data ------------- */
  if (blocosDoDia.length === 0) {
    const proximos = alternativasProximas(
      await blocosLivres(supabase, fuso, diasSeguintes(dia, JANELA_ALTERNATIVAS, fuso)),
      instanteDe(dia.ano, dia.mes, dia.dia, 12, 0, fuso),
      3,
    )

    return json({
      sucesso: true,
      disponivel: false,
      horarios: [],
      mensagem: proximos.length
        ? `Não tenho horário livre em ${dataCurta(instanteDe(dia.ano, dia.mes, dia.dia, 12, 0, fuso), fuso)}. Tenho ${fraseAlternativas(proximos, fuso)}. Serve?`
        : `Não tenho horário livre em ${dataCurta(instanteDe(dia.ano, dia.mes, dia.dia, 12, 0, fuso), fuso)} nem nos próximos dias.`,
    })
  }

  // Espalha as opções ao longo do dia em vez de dar as quatro primeiras:
  // manhã inteira como única oferta perde quem só pode à tarde.
  const escolhidos = espalhar(blocosDoDia, 4)

  return json({
    sucesso: true,
    disponivel: true,
    horarios: escolhidos.map((bloco) => horaFalada(bloco.inicio, fuso)),
    mensagem: `Em ${dataCurta(escolhidos[0].inicio, fuso)} tenho ${listar(escolhidos.map((b) => horaFalada(b.inicio, fuso)), 'ou')}. Qual prefere?`,
  })
}

/** Amostra distribuída: primeiro, último e os intermediários espaçados. */
function espalhar(blocos: Bloco[], quantidade: number): Bloco[] {
  if (blocos.length <= quantidade) return blocos
  const passo = (blocos.length - 1) / (quantidade - 1)
  return Array.from({ length: quantidade }, (_, i) => blocos[Math.round(i * passo)])
}

/* ------------------------------------------------------------------ */
/* POST /agenda/agendar                                                */
/* ------------------------------------------------------------------ */

export async function agendar(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  const fuso = await fusoDaImobiliaria(supabase)

  const whatsapp = normalizarWhatsapp(corpo.whatsapp)
  if (!whatsapp) {
    return erro('parametro_invalido', 'Preciso do WhatsApp com DDD para marcar a visita.')
  }

  const momento = lerMomento(corpo, fuso, true)
  if (momento instanceof Response) return momento
  const { dia, instante } = momento
  if (!instante) return erro('parametro_invalido', 'Preciso também do horário, por exemplo 15:00.')

  if (instante.getTime() < Date.now()) {
    return erro('data_no_passado', 'Esse horário já passou. Me diga uma data a partir de hoje.')
  }

  /* ---------------------------------------------------- o imóvel --- */
  // O código é opcional de propósito: quem chega por indicação marca a
  // visita antes de escolher o imóvel, e é comum o corretor mostrar dois
  // ou três no mesmo passeio. Exigir o código forçaria o agente a
  // perguntar "qual deles?" no momento em que a pessoa acabou de
  // oferecer um horário — que é quando a conversa esfria.
  let imovel: { id: string; codigo: string } | null = null
  if (typeof corpo.codigo_imovel === 'string' && corpo.codigo_imovel.trim()) {
    const escrito = corpo.codigo_imovel.trim()

    // Mesma normalização de `/imoveis/buscar`, e por isso ela mora em
    // `_compartilhado`. Antes daqui a comparação era o texto cru contra
    // a coluna, e `IMV-029` recusava a visita inteira de um imóvel que
    // existe: o trigger 2 grava o número sempre com quatro dígitos, de
    // modo que `29`, `029` e `0029` só podem ser o mesmo registro. O
    // sintoma era da pior espécie, porque o agente conseguia consultar
    // aquele mesmo código e falhava só ao marcar, e a frase ainda pedia
    // ao cliente que conferisse um código que ele tinha lido certo.
    const codigo = normalizarCodigo(escrito)

    // Código irreconhecível não vira busca. É `parametro_invalido` e não
    // `imovel_nao_encontrado` porque as duas causas são diferentes e
    // pedem coisas diferentes de quem lê o log: aqui o campo veio com
    // algo que não é código, o que na prática costuma ser mapeamento
    // solto do N8N. Para a conversa dá no mesmo, e é de propósito: as
    // duas mensagens terminam pedindo o código.
    if (!codigo) {
      return erro(
        'parametro_invalido',
        `Não reconheci ${escrito} como código de imóvel. Eles têm o formato IMV-0001. Qual é o código do imóvel que você quer visitar?`,
      )
    }

    const { data } = await supabase
      .from('imoveis')
      .select('id, codigo')
      .eq('codigo', codigo)
      .maybeSingle()

    // Código válido que não existe **recusa a visita**, mesmo o campo
    // sendo opcional. Marcar assim mesmo gravaria um agendamento sem
    // imóvel para uma pessoa que citou um, e o corretor chegaria na
    // visita sem saber o que mostrar. A frase segue oferecendo a saída,
    // porque quem decide é o cliente: se ele responder que tanto faz, o
    // agente refaz a chamada sem `codigo_imovel` e a visita é marcada.
    if (!data) {
      return erro(
        'imovel_nao_encontrado',
        `Não encontrei o imóvel ${codigo}. Confere o código pra mim? Se preferir, posso marcar a visita e a gente define o imóvel depois.`,
      )
    }
    imovel = data
  }

  /* ------------------------------------------------------ o lead --- */
  const lead = await garantirLead(supabase, consumidor, whatsapp, corpo.nome, imovel?.codigo)
  if (lead instanceof Response) return lead

  /* --------------------------------------------------- o corretor -- */
  const escolha = await escolherCorretor(supabase, fuso, dia, instante, corpo.id_corretor)
  if (escolha instanceof Response) return escolha

  /* ------------------------------------------------------ gravar --- */
  const fim = new Date(instante.getTime() + DURACAO_VISITA * 60_000)

  const { data: visita, error } = await supabase
    .from('agendamentos')
    .insert({
      id_lead: lead.id,
      id_corretor: escolha.id,
      id_imovel: imovel?.id ?? null,
      // Copiado no momento do agendamento, não lido por junção depois: a
      // exclusão de imóvel é definitiva, e sem a cópia o histórico não
      // diria o que foi visitado.
      codigo_imovel: imovel?.codigo ?? null,
      data_hora_inicio: instante.toISOString(),
      data_hora_fim: fim.toISOString(),
      observacoes: typeof corpo.observacoes === 'string' ? corpo.observacoes.slice(0, 2000) : null,
      origem: 'agente_ia',
    })
    .select('id')
    .single()

  if (error) return await respostaDeTrigger(supabase, fuso, dia, instante, error)

  // O status do lead é do trigger 8. Atualizar aqui criaria uma segunda
  // fonte de verdade que diverge no primeiro caso de borda — ver
  // CLAUDE.md, "Conflito e janela: banco é a fonte de verdade".
  await registrar(supabase, consumidor, {
    acao: AcoesEscrita.agendamentoCriado,
    tabela: 'agendamentos',
    idRegistro: visita.id,
    dadosNovos: {
      data_hora_inicio: instante.toISOString(),
      codigo_imovel: imovel?.codigo ?? null,
      whatsapp,
      corretor: `${escolha.nome} ${escolha.sobrenome}`,
    },
  })

  // `data_hora` é para o fluxo do N8N, não para a conversa. Quem lê no
  // WhatsApp lê a `mensagem`.
  return sucessoAgenda(
    visita.id,
    `Visita confirmada para ${porExtenso(instante, fuso)}, com ${escolha.nome}.`,
    timestampNoFuso(instante, fuso),
  )
}

/* ------------------------------------------------------------------ */
/* POST /agenda/reagendar                                              */
/* ------------------------------------------------------------------ */

export async function reagendar(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  const fuso = await fusoDaImobiliaria(supabase)

  const id = lerUuid(corpo.id_agendamento)
  if (!id) {
    return erro('parametro_invalido', 'Preciso do identificador da visita que você quer remarcar.')
  }

  const momento = lerMomento(corpo, fuso, true)
  if (momento instanceof Response) return momento
  const { dia, instante } = momento
  if (!instante) return erro('parametro_invalido', 'Preciso também do novo horário.')

  if (instante.getTime() < Date.now()) {
    return erro('data_no_passado', 'Esse horário já passou. Me diga uma data a partir de hoje.')
  }

  const { data: atual } = await supabase
    .from('agendamentos')
    .select('id, id_corretor, status, data_hora_inicio')
    .eq('id', id)
    .maybeSingle()

  if (!atual) {
    return erro('agendamento_nao_encontrado', 'Não encontrei essa visita.')
  }
  if (atual.status === 'cancelada') {
    return erro(
      'agendamento_nao_encontrado',
      'Essa visita foi cancelada. Posso marcar uma nova, é só me dizer o dia e o horário.',
    )
  }

  // O corretor de antes pode não atender no novo horário. Reavaliar em
  // vez de insistir nele evita recusar um remarque que a equipe cobriria
  // sem problema.
  const escolha = await escolherCorretor(supabase, fuso, dia, instante, corpo.id_corretor, {
    ignorarAgendamento: id,
    preferido: atual.id_corretor,
  })
  if (escolha instanceof Response) return escolha

  const fim = new Date(instante.getTime() + DURACAO_VISITA * 60_000)

  const { error } = await supabase
    .from('agendamentos')
    .update({
      data_hora_inicio: instante.toISOString(),
      data_hora_fim: fim.toISOString(),
      id_corretor: escolha.id,
      status: 'agendada',
    })
    .eq('id', id)

  if (error) return await respostaDeTrigger(supabase, fuso, dia, instante, error, id)

  await registrar(supabase, consumidor, {
    acao: AcoesEscrita.agendamentoAtualizado,
    tabela: 'agendamentos',
    idRegistro: id,
    dadosAnteriores: { data_hora_inicio: atual.data_hora_inicio, id_corretor: atual.id_corretor },
    dadosNovos: {
      data_hora_inicio: instante.toISOString(),
      corretor: `${escolha.nome} ${escolha.sobrenome}`,
    },
  })

  // Mesmo motivo de `agendar`, e aqui até mais forte: o que mudou foi
  // exatamente o horário, então quem tem a visita num calendário precisa
  // do valor novo em forma de campo para mover o evento.
  return sucessoAgenda(
    id,
    `Visita remarcada para ${porExtenso(instante, fuso)}, com ${escolha.nome}.`,
    timestampNoFuso(instante, fuso),
  )
}

/* ------------------------------------------------------------------ */
/* POST /agenda/cancelar                                               */
/* ------------------------------------------------------------------ */

export async function cancelar(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  corpo: Record<string, unknown>,
): Promise<Response> {
  const fuso = await fusoDaImobiliaria(supabase)

  const id = lerUuid(corpo.id_agendamento)
  if (!id) {
    return erro('parametro_invalido', 'Preciso do identificador da visita que você quer cancelar.')
  }

  const { data: atual } = await supabase
    .from('agendamentos')
    .select('id, status, data_hora_inicio, observacoes')
    .eq('id', id)
    .maybeSingle()

  if (!atual) return erro('agendamento_nao_encontrado', 'Não encontrei essa visita.')

  if (atual.status === 'cancelada') {
    return sucessoAgenda(id, 'Essa visita já estava cancelada.')
  }

  const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim().slice(0, 500) : ''
  const observacoes = motivo
    ? [atual.observacoes, `Cancelada pelo cliente: ${motivo}`].filter(Boolean).join('\n')
    : atual.observacoes

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelada', observacoes })
    .eq('id', id)

  if (error) throw error

  // O reflexo no lead é do trigger 8, inclusive a regra de só rebaixar
  // para `cancelou` quando não restar nenhuma outra visita agendada.
  await registrar(supabase, consumidor, {
    acao: AcoesEscrita.agendamentoCancelado,
    tabela: 'agendamentos',
    idRegistro: id,
    dadosAnteriores: { status: atual.status },
    dadosNovos: { status: 'cancelada', motivo: motivo || null },
  })

  return sucessoAgenda(
    id,
    `Visita de ${porExtenso(new Date(atual.data_hora_inicio), fuso)} cancelada.`,
  )
}

/* ------------------------------------------------------------------ */
/* GET /agenda/visitas                                                 */
/* ------------------------------------------------------------------ */

/**
 * O endpoint que resolve "quero cancelar minha visita".
 *
 * O cliente não sabe o id, e frequentemente tem mais de uma marcada. O
 * agente consulta aqui, apresenta as opções e usa o **id devolvido** para
 * cancelar ou remarcar — que é o que elimina a ambiguidade de identificar
 * uma visita por data no meio de uma conversa.
 */
export async function listarVisitas(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  url: URL,
): Promise<Response> {
  const fuso = await fusoDaImobiliaria(supabase)

  let consulta = supabase
    .from('agendamentos')
    .select(
      'id, data_hora_inicio, status, codigo_imovel, crm_imobiliaria ( whatsapp, nome ), imoveis ( codigo, titulo, bairro ), corretores ( nome, sobrenome )',
    )
    .order('data_hora_inicio', { ascending: true })
    .limit(50)

  const whatsapp = normalizarWhatsapp(url.searchParams.get('whatsapp'))
  if (whatsapp) {
    const { data: lead } = await supabase
      .from('crm_imobiliaria')
      .select('id')
      .eq('whatsapp', whatsapp)
      .maybeSingle()

    if (!lead) {
      return sucesso([], 'Não encontrei nenhuma visita para esse contato.')
    }
    consulta = consulta.eq('id_lead', lead.id)
  }

  const corretor = lerUuid(url.searchParams.get('id_corretor'))
  if (corretor) consulta = consulta.eq('id_corretor', corretor)

  const de = lerData(url.searchParams.get('de'))
  if (de) {
    consulta = consulta.gte('data_hora_inicio', instanteDe(de.ano, de.mes, de.dia, 0, 0, fuso).toISOString())
  }

  const ate = lerData(url.searchParams.get('ate'))
  if (ate) {
    // `ate` é o último dia desejado; o corte é a meia-noite do seguinte.
    consulta = consulta.lt(
      'data_hora_inicio',
      instanteDe(ate.ano, ate.mes, ate.dia + 1, 0, 0, fuso).toISOString(),
    )
  }

  const status = url.searchParams.get('status')
  if (status && ['agendada', 'realizada', 'cancelada', 'reagendada'].includes(status)) {
    consulta = consulta.eq('status', status)
  }

  const { data, error } = await consulta
  if (error) throw error

  const visitas = (data ?? []).map((linha) => {
    const bruto = linha as unknown as {
      id: string
      data_hora_inicio: string
      status: string
      codigo_imovel: string | null
      imoveis: { codigo: string; titulo: string; bairro: string } | null
      corretores: { nome: string; sobrenome: string } | null
    }
    const inicio = new Date(bruto.data_hora_inicio)
    return {
      id_agendamento: bruto.id,
      quando: porExtenso(inicio, fuso),
      data: bruto.data_hora_inicio,
      status: bruto.status,
      // O código gravado sobrevive à exclusão do imóvel; a junção, não.
      codigo_imovel: bruto.imoveis?.codigo ?? bruto.codigo_imovel,
      imovel: bruto.imoveis?.titulo ?? null,
      corretor: bruto.corretores ? `${bruto.corretores.nome} ${bruto.corretores.sobrenome}` : null,
    }
  })

  await registrar(supabase, consumidor, {
    acao: AcoesApi.visitasConsultadas,
    tabela: 'agendamentos',
    dadosNovos: { whatsapp: whatsapp ?? null, encontradas: visitas.length },
  })

  const agendadas = visitas.filter((v) => v.status === 'agendada')

  return sucesso(
    visitas,
    agendadas.length === 0
      ? 'Não há visitas agendadas.'
      : agendadas.length === 1
        ? `Há uma visita marcada: ${agendadas[0].quando}.`
        : `Há ${agendadas.length} visitas marcadas: ${listar(agendadas.map((v) => v.quando), 'e')}.`,
  )
}

/* ------------------------------------------------------------------ */
/* Apoio                                                               */
/* ------------------------------------------------------------------ */

function lerUuid(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpo)
    ? limpo
    : null
}

/**
 * Encontra ou cria o lead.
 *
 * **É a única escrita em `crm_imobiliaria` que a API realiza.** Existe
 * porque não faz sentido recusar um agendamento por falta de cadastro
 * prévio: o cliente acabou de oferecer um horário, e responder "você
 * precisa se cadastrar antes" perde a visita.
 *
 * `upsert` por `whatsapp`, que é a chave natural — nunca "buscar e
 * criar", que abriria corrida entre duas mensagens quase simultâneas do
 * mesmo número.
 */
async function garantirLead(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  whatsapp: string,
  nome: unknown,
  codigoImovel: string | undefined,
): Promise<{ id: string; novo: boolean } | Response> {
  const { data: existente } = await supabase
    .from('crm_imobiliaria')
    .select('id, codigo_imovel_interesse')
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (existente) {
    // O código de interesse alimenta o funil e o Dashboard. Só é gravado
    // quando ainda não havia um: sobrescrever apagaria o imóvel que
    // trouxe o lead ao sistema.
    if (codigoImovel && !existente.codigo_imovel_interesse) {
      await supabase
        .from('crm_imobiliaria')
        .update({ codigo_imovel_interesse: codigoImovel })
        .eq('id', existente.id)
    }
    return { id: existente.id, novo: false }
  }

  const { data, error } = await supabase
    .from('crm_imobiliaria')
    .upsert(
      {
        whatsapp,
        nome: typeof nome === 'string' && nome.trim() ? nome.trim().slice(0, 120) : null,
        origem: 'agente_ia',
        codigo_imovel_interesse: codigoImovel ?? null,
      },
      { onConflict: 'whatsapp' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('[agenda] falha ao criar o lead:', error.message)
    return erro('erro_interno', 'Não consegui registrar seu contato agora. Pode tentar de novo?')
  }

  await registrar(supabase, consumidor, {
    acao: AcoesEscrita.leadCriado,
    tabela: 'crm_imobiliaria',
    idRegistro: data.id,
    dadosNovos: { whatsapp, codigo_imovel_interesse: codigoImovel ?? null },
  })

  return { id: data.id, novo: true }
}

interface CorretorEscolhido {
  id: string
  nome: string
  sobrenome: string
}

/**
 * Decide quem conduz a visita.
 *
 * Quando o corretor não vem informado — o caso normal, porque o cliente
 * não tem como escolher —, a API pega entre os livres o **menos
 * carregado**. Sempre o primeiro da lista concentraria a agenda inteira
 * em quem aparece primeiro no alfabeto.
 */
async function escolherCorretor(
  supabase: SupabaseClient,
  fuso: string,
  dia: Dia,
  instante: Date,
  pedido: unknown,
  opcoes: { ignorarAgendamento?: string; preferido?: string } = {},
): Promise<CorretorEscolhido | Response> {
  const blocos = await blocosLivres(supabase, fuso, [dia], {
    ignorarAgendamento: opcoes.ignorarAgendamento,
  })
  const bloco = blocos.find((b) => b.inicio.getTime() === instante.getTime())

  if (!bloco) {
    const alternativas = alternativasProximas(
      await blocosLivres(supabase, fuso, diasSeguintes(dia, JANELA_ALTERNATIVAS, fuso), {
        ignorarAgendamento: opcoes.ignorarAgendamento,
      }),
      instante,
      3,
    )
    const frase = alternativas.length
      ? ` Tenho ${fraseAlternativas(alternativas, fuso)}. Qual fica melhor pra você?`
      : ' Posso pedir para alguém da equipe entrar em contato para achar um horário?'

    if (alternativas.length === 0) {
      const { count } = await supabase
        .from('corretores')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)

      if (!count) {
        return erro(
          'sem_corretores',
          'Ainda não tenho ninguém disponível para conduzir visitas. Vou pedir para alguém da equipe falar com você.',
        )
      }
    }

    // "Está cheio" e "não atendemos nesse horário" são recusas
    // diferentes, e o agente trata cada uma de um jeito: a primeira pede
    // outro horário, a segunda explica que a imobiliária não abre.
    // Colapsar as duas em `horario_ocupado` faria o agente insistir num
    // domingo dizendo que talvez vague.
    const naJanela = await blocosLivres(supabase, fuso, [dia], { apenasJanela: true })
    const atendeNesseHorario = naJanela.some((b) => b.inicio.getTime() === instante.getTime())

    if (!atendeNesseHorario) {
      return erro('fora_da_janela', `Não atendemos ${porExtenso(instante, fuso)}.${frase}`)
    }

    if (alternativas.length === 0) {
      return erro(
        'sem_corretor_disponivel',
        `${porExtenso(instante, fuso)} não está disponível, e nos próximos dias também não encontrei horário livre. Posso pedir para alguém da equipe entrar em contato?`,
      )
    }

    return erro('horario_ocupado', `${porExtenso(instante, fuso)} já foi preenchido.${frase}`)
  }

  const idPedido = lerUuid(pedido)
  if (idPedido) {
    const especifico = bloco.corretores.find((c) => c.id === idPedido)
    if (!especifico) {
      const todos = await blocosLivres(
        supabase,
        fuso,
        diasSeguintes(dia, JANELA_ALTERNATIVAS, fuso),
        { ignorarAgendamento: opcoes.ignorarAgendamento },
      )
      const alternativas = alternativasProximas(
        todos.filter((b) => b.corretores.some((c) => c.id === idPedido)),
        instante,
        3,
      )
      return erro(
        'horario_ocupado',
        alternativas.length
          ? `Esse corretor não está livre ${porExtenso(instante, fuso).replace(/^\w+-?\w*, /, '')}. Com ele tenho ${fraseAlternativas(alternativas, fuso)}.`
          : 'Esse corretor não tem horário livre nos próximos dias. Posso marcar com outra pessoa da equipe?',
      )
    }
    return especifico
  }

  // Num remarque, quem já estava com a visita tem preferência — trocar o
  // corretor sem necessidade quebra a continuidade do atendimento.
  if (opcoes.preferido) {
    const mesmo = bloco.corretores.find((c) => c.id === opcoes.preferido)
    if (mesmo) return mesmo
  }

  return await corretorMenosCarregado(supabase, bloco.corretores)
}

/**
 * Traduz a recusa do banco.
 *
 * Os triggers 4 e 5 já respondem em português e com o horário do
 * conflito, mas a frase deles é de painel — fala em "corretor" e "janela
 * de atendimento", conceitos que o cliente do WhatsApp não tem por que
 * conhecer. Aqui a mesma recusa vira uma frase de conversa, com as
 * alternativas dentro.
 *
 * Isto é rede de segurança, não a validação principal: entre calcular a
 * disponibilidade e gravar existe uma janela em que outra conversa pode
 * ter ocupado o horário.
 */
async function respostaDeTrigger(
  supabase: SupabaseClient,
  fuso: string,
  dia: Dia,
  instante: Date,
  falha: { message?: string; code?: string },
  ignorarAgendamento?: string,
): Promise<Response> {
  const mensagem = falha.message ?? ''

  const alternativas = alternativasProximas(
    await blocosLivres(supabase, fuso, diasSeguintes(dia, JANELA_ALTERNATIVAS, fuso), {
      ignorarAgendamento,
    }),
    instante,
    3,
  )
  const frase = alternativas.length
    ? ` Tenho ${fraseAlternativas(alternativas, fuso)}. Qual fica melhor pra você?`
    : ' Posso pedir para alguém da equipe entrar em contato para achar um horário?'

  if (mensagem.includes('Conflito de agenda')) {
    return erro('horario_ocupado', `${porExtenso(instante, fuso)} já foi preenchido.${frase}`)
  }

  if (mensagem.includes('fora da janela')) {
    return erro(
      'fora_da_janela',
      `Não atendemos ${porExtenso(instante, fuso)}.${frase}`,
    )
  }

  console.error('[agenda] erro inesperado ao gravar:', mensagem)
  return erro('erro_interno', 'Não consegui confirmar a visita agora. Pode tentar de novo?')
}
