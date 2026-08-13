import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { ANTECEDENCIA_MINIMA, DURACAO_VISITA } from './ambiente.ts'
import { instanteDe, minutosDeHora, partesNoFuso } from './datas.ts'

/**
 * Cálculo dos horários livres.
 *
 * É a lógica mais delicada do sistema, e o motivo é que ela tem de
 * **prever exatamente o que os triggers 4 e 5 vão responder**. O banco é
 * a fonte de verdade: se o cálculo daqui for mais permissivo, o agente
 * oferece um horário e o `insert` é recusado logo depois — na frente do
 * cliente, no meio da conversa. Se for mais restritivo, a imobiliária
 * perde visitas que poderiam ter sido marcadas.
 *
 * **A API não recebe corretor.** Corretor é livre no ImobFlow: qualquer
 * um conduz qualquer visita. Um horário está disponível quando **pelo
 * menos um** corretor ativo estiver livre nele, e o agente não precisa
 * saber quem — nem deveria, porque perguntar "com qual corretor?" na
 * conversa é uma pergunta que o cliente não tem como responder.
 */

export interface CorretorDisponivel {
  id: string
  nome: string
  sobrenome: string
}

export interface Bloco {
  inicio: Date
  fim: Date
  /** Quem está livre neste bloco. Nunca vazio — bloco sem ninguém é descartado. */
  corretores: CorretorDisponivel[]
}

interface HorarioJanela {
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

interface CorretorBruto {
  id: string
  nome: string
  sobrenome: string
  agendas: { agendas_horarios: HorarioJanela[] } | null
}

export interface Dia {
  ano: number
  mes: number
  dia: number
}

/**
 * Blocos livres nos dias informados.
 *
 * Recebe vários dias de uma vez porque o caso que mais importa é o de
 * erro: quando o horário pedido está ocupado, a resposta precisa trazer
 * alternativas, e alternativa boa frequentemente é no dia seguinte.
 * Buscar corretores e agendamentos uma vez para todo o intervalo evita
 * repetir as mesmas duas consultas por dia.
 */
export interface OpcoesBlocos {
  /** Visita que não deve contar como ocupação — o caso do remarque. */
  ignorarAgendamento?: string
  /**
   * Devolve os blocos da janela **mesmo ocupados**, e sem o corte de
   * antecedência. Serve só ao diagnóstico: é o que distingue "esse
   * horário está cheio" de "não atendemos nesse horário", duas recusas
   * que o agente precisa tratar de formas diferentes.
   */
  apenasJanela?: boolean
}

export async function blocosLivres(
  supabase: SupabaseClient,
  fuso: string,
  dias: Dia[],
  opcoes: OpcoesBlocos = {},
): Promise<Bloco[]> {
  if (dias.length === 0) return []

  const { data: corretoresBrutos, error: erroCorretores } = await supabase
    .from('corretores')
    .select('id, nome, sobrenome, agendas ( agendas_horarios ( dia_semana, hora_inicio, hora_fim, ativo ) )')
    .eq('ativo', true)
    .order('nome')

  if (erroCorretores) throw erroCorretores

  const corretores = (corretoresBrutos ?? []) as unknown as CorretorBruto[]
  if (corretores.length === 0) return []

  // Intervalo que cobre todos os dias pedidos, para uma consulta só.
  const ordenados = [...dias].sort(compararDias)
  const inicioIntervalo = instanteDe(
    ordenados[0].ano,
    ordenados[0].mes,
    ordenados[0].dia,
    0,
    0,
    fuso,
  )
  const ultimo = ordenados[ordenados.length - 1]
  const fimIntervalo = instanteDe(ultimo.ano, ultimo.mes, ultimo.dia + 1, 0, 0, fuso)

  // Só `agendada` e `realizada` ocupam a agenda — é a mesma condição do
  // trigger 4. Visita cancelada libera o horário, e é isso que permite
  // remarcar em cima do que foi cancelado.
  const { data: ocupacoes, error: erroOcupacoes } = await supabase
    .from('agendamentos')
    .select('id, id_corretor, data_hora_inicio, data_hora_fim')
    .in('status', ['agendada', 'realizada'])
    .gte('data_hora_inicio', inicioIntervalo.toISOString())
    .lt('data_hora_inicio', fimIntervalo.toISOString())

  if (erroOcupacoes) throw erroOcupacoes

  const ocupadosPorCorretor = new Map<string, { inicio: number; fim: number }[]>()
  for (const ocupacao of ocupacoes ?? []) {
    if (opcoes.ignorarAgendamento && ocupacao.id === opcoes.ignorarAgendamento) continue
    const lista = ocupadosPorCorretor.get(ocupacao.id_corretor) ?? []
    lista.push({
      inicio: new Date(ocupacao.data_hora_inicio).getTime(),
      fim: new Date(ocupacao.data_hora_fim).getTime(),
    })
    ocupadosPorCorretor.set(ocupacao.id_corretor, lista)
  }

  // "Livre" e "possível" não são a mesma coisa: o bloco das 15h continua
  // vago às 14h58, e oferecê-lo marca uma visita que ninguém consegue
  // cumprir. O corte é configurável porque a distância necessária é da
  // imobiliária, não do sistema.
  const pisoDeTempo = opcoes.apenasJanela ? 0 : Date.now() + ANTECEDENCIA_MINIMA() * 60_000

  const blocos: Bloco[] = []

  for (const dia of ordenados) {
    const diaSemana = partesNoFuso(instanteDe(dia.ano, dia.mes, dia.dia, 12, 0, fuso), fuso).diaSemana

    // Minuto do dia → quem está livre nele.
    const porMinuto = new Map<number, CorretorDisponivel[]>()

    for (const corretor of corretores) {
      const janela = (corretor.agendas?.agendas_horarios ?? []).find(
        (h) => h.ativo && h.dia_semana === diaSemana,
      )
      if (!janela) continue

      const abre = minutosDeHora(janela.hora_inicio)
      const fecha = minutosDeHora(janela.hora_fim)
      const ocupados = ocupadosPorCorretor.get(corretor.id) ?? []

      // O trigger exige que o FIM da visita caiba na janela, e não só o
      // começo. Gerar um bloco às 17h45 numa janela que fecha às 18h
      // ofereceria um horário que o banco recusa.
      for (let minuto = abre; minuto + DURACAO_VISITA <= fecha; minuto += DURACAO_VISITA) {
        const inicio = instanteDe(
          dia.ano,
          dia.mes,
          dia.dia,
          Math.floor(minuto / 60),
          minuto % 60,
          fuso,
        )
        if (inicio.getTime() < pisoDeTempo) continue

        const fim = new Date(inicio.getTime() + DURACAO_VISITA * 60_000)
        if (!opcoes.apenasJanela) {
          const conflita = ocupados.some(
            (o) => o.inicio < fim.getTime() && o.fim > inicio.getTime(),
          )
          if (conflita) continue
        }

        const lista = porMinuto.get(minuto) ?? []
        lista.push({ id: corretor.id, nome: corretor.nome, sobrenome: corretor.sobrenome })
        porMinuto.set(minuto, lista)
      }
    }

    for (const [minuto, livres] of [...porMinuto.entries()].sort((a, b) => a[0] - b[0])) {
      const inicio = instanteDe(dia.ano, dia.mes, dia.dia, Math.floor(minuto / 60), minuto % 60, fuso)
      blocos.push({
        inicio,
        fim: new Date(inicio.getTime() + DURACAO_VISITA * 60_000),
        corretores: livres,
      })
    }
  }

  return blocos
}

function compararDias(a: Dia, b: Dia): number {
  return a.ano - b.ano || a.mes - b.mes || a.dia - b.dia
}

/** Os `quantidade` dias a partir do informado, inclusive. */
export function diasSeguintes(base: Dia, quantidade: number, fuso: string): Dia[] {
  const saida: Dia[] = []
  for (let i = 0; i < quantidade; i++) {
    const instante = instanteDe(base.ano, base.mes, base.dia + i, 12, 0, fuso)
    const p = partesNoFuso(instante, fuso)
    saida.push({ ano: p.ano, mes: p.mes, dia: p.dia })
  }
  return saida
}

/**
 * Escolhe até `limite` alternativas próximas de um horário pedido.
 *
 * A proximidade é medida em tempo absoluto a partir do horário desejado,
 * e não "os próximos da lista": quem pediu 15h prefere 14h30 a 17h, e um
 * corte que só olhasse para a frente ofereceria sempre o pior dos dois.
 */
export function alternativasProximas(blocos: Bloco[], desejado: Date, limite = 3): Bloco[] {
  return [...blocos]
    .sort(
      (a, b) =>
        Math.abs(a.inicio.getTime() - desejado.getTime()) -
        Math.abs(b.inicio.getTime() - desejado.getTime()),
    )
    .slice(0, limite)
}

/**
 * Corretor menos carregado entre os livres.
 *
 * Sempre pegar o primeiro concentraria a agenda inteira em quem aparece
 * primeiro na ordem alfabética, e a imobiliária descobriria isso pelo
 * corretor reclamando. A contagem é das visitas ainda agendadas daqui
 * para frente — carga futura, que é a que pesa.
 */
export async function corretorMenosCarregado(
  supabase: SupabaseClient,
  candidatos: CorretorDisponivel[],
): Promise<CorretorDisponivel> {
  if (candidatos.length === 1) return candidatos[0]

  const { data } = await supabase
    .from('agendamentos')
    .select('id_corretor')
    .eq('status', 'agendada')
    .gte('data_hora_inicio', new Date().toISOString())
    .in(
      'id_corretor',
      candidatos.map((c) => c.id),
    )

  const carga = new Map<string, number>()
  for (const linha of data ?? []) {
    carga.set(linha.id_corretor, (carga.get(linha.id_corretor) ?? 0) + 1)
  }

  // Empate resolvido pelo id, para o resultado ser reproduzível — o que
  // importa quando alguém for depurar por que a visita caiu com fulano.
  return [...candidatos].sort(
    (a, b) => (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0) || a.id.localeCompare(b.id),
  )[0]
}
