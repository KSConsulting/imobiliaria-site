import { supabase } from '@/lib/supabase'
import { horaCurta, minutosDeHora } from '@/lib/datas'
import type { Json } from '@/tipos/banco'

/**
 * Horário de atendimento ao público da imobiliária.
 *
 * **Não é a janela de visitas.** Quem decide se um agendamento cabe é
 * `agendas_horarios`, a janela de cada corretor, validada pelos triggers
 * 4 e 5. Isto aqui é declarativo: alimenta a frase que o agente fala no
 * WhatsApp e o bloco do site, e não recusa nada.
 *
 * Os dois são diferentes de verdade — a imobiliária abre das 9h às 18h e
 * pode fazer visitas só das 10h às 16h. O que não pode é declarar mais
 * largo do que os corretores cobrem, porque aí o agente promete um
 * horário que o banco recusa. É o que `conferirCoberturaCorretores`
 * existe para apontar antes de salvar.
 *
 * **A frase é montada aqui e no banco**, em `fn_horario_funcionamento_-
 * legivel` (migration …023). A duplicação é consciente e limitada: lá
 * ela serve ao agente, aqui serve à prévia que o operador lê antes de
 * salvar. Uma prévia que não fosse a frase exata não teria utilidade
 * nenhuma. **Mexeu numa, mexa na outra.**
 */

/** 0 = domingo, mesma convenção de `agendas_horarios.dia_semana`. */
export interface DiaFuncionamento {
  dia: number
  aberto: boolean
  abre: string
  fecha: string
}

/**
 * A semana começa na segunda, não no domingo da convenção de `dia`.
 *
 * É como se lê horário comercial. Começando no domingo, toda imobiliária
 * de segunda a sexta abriria a frase pelo dia em que está fechada.
 */
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]

/** Indexado por `dia`, não pela ordem de leitura. */
export const NOMES_DIAS_FUNCIONAMENTO = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

export const ABRE_PADRAO = '09:00'
export const FECHA_PADRAO = '18:00'

/** Posição na semana lida, para conferir contiguidade. */
function posicao(dia: number): number {
  return ORDEM_SEMANA.indexOf(dia)
}

/* ------------------------------------------------------------------ */
/* Leitura e escrita                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sete linhas, sempre, em ordem de leitura.
 *
 * Tolerante de propósito: a coluna é `jsonb` e a tela precisa abrir
 * mesmo diante de um cadastro torto, em vez de quebrar e impedir a
 * correção justamente de quem ia corrigir.
 */
export function lerHorario(bruto: Json | null | undefined): DiaFuncionamento[] {
  const lista = Array.isArray(bruto) ? bruto : []

  return ORDEM_SEMANA.map((dia) => {
    const item = lista.find(
      (v): v is Record<string, Json> =>
        typeof v === 'object' && v !== null && !Array.isArray(v) && v.dia === dia,
    )

    return {
      dia,
      aberto: item?.aberto === true,
      // `slice(0, 5)` porque `time` do Postgres volta como "09:00:00".
      abre: typeof item?.abre === 'string' ? item.abre.slice(0, 5) : ABRE_PADRAO,
      fecha: typeof item?.fecha === 'string' ? item.fecha.slice(0, 5) : FECHA_PADRAO,
    }
  })
}

/**
 * Nenhum dia aberto grava `null`, não um array de sete "fechado".
 *
 * Os dois significariam a mesma coisa para quem lê, e uma imobiliária
 * fechada a semana inteira não existe: o estado real ali é "ainda não
 * informado". Guardar `null` faz a view e o site omitirem o bloco pela
 * mesma regra que já vale para todos os outros campos vazios.
 */
export function paraJson(dias: DiaFuncionamento[]): Json | null {
  if (!dias.some((d) => d.aberto)) return null

  return ORDEM_SEMANA.map((dia) => {
    const linha = dias.find((d) => d.dia === dia)
    return linha?.aberto
      ? { dia, aberto: true, abre: linha.abre, fecha: linha.fecha }
      : { dia, aberto: false }
  })
}

/* ------------------------------------------------------------------ */
/* Agrupamento                                                         */
/* ------------------------------------------------------------------ */

export interface GrupoAberto {
  /** Em ordem de leitura da semana. */
  dias: number[]
  abre: string
  fecha: string
}

export interface HorarioAgrupado {
  abertos: GrupoAberto[]
  /** Uma lista só, sempre no fim. Nunca intercalada entre os abertos. */
  fechados: number[]
}

/**
 * Agrupa dias que compartilham o mesmo horário.
 *
 * **O agrupamento acontece sobre a lista já filtrada de abertos**, e é o
 * que permite juntar dias não vizinhos: segunda, quarta e sexta são
 * consecutivos entre os abertos e viram um grupo só.
 *
 * Os fechados saem numa lista à parte porque, tratados como grupo de
 * primeira classe, eles se intercalam e a frase passa a abrir pelo que a
 * imobiliária não faz.
 */
export function agruparHorario(dias: DiaFuncionamento[]): HorarioAgrupado {
  const ordenados = ORDEM_SEMANA.map((dia) => dias.find((d) => d.dia === dia)).filter(
    (d): d is DiaFuncionamento => Boolean(d),
  )

  const abertos: GrupoAberto[] = []
  for (const linha of ordenados.filter((d) => d.aberto)) {
    const anterior = abertos.at(-1)
    if (anterior && anterior.abre === linha.abre && anterior.fecha === linha.fecha) {
      anterior.dias.push(linha.dia)
    } else {
      abertos.push({ dias: [linha.dia], abre: linha.abre, fecha: linha.fecha })
    }
  }

  return {
    abertos,
    fechados: ordenados.filter((d) => !d.aberto).map((d) => d.dia),
  }
}

/**
 * "todos os dias", "segunda a sexta", "sábado e domingo", "segunda,
 * quarta e sexta".
 *
 * **Intervalo só a partir de três dias e só quando eles são contíguos na
 * semana.** Sem a checagem de contiguidade, segunda, quarta e sexta
 * virariam "segunda a sexta", que afirma a terça. E para dois dias
 * "sábado e domingo" é mais curto e mais claro do que "sábado a
 * domingo".
 */
export function rotularDias(dias: number[]): string {
  const nomes = dias.map((d) => NOMES_DIAS_FUNCIONAMENTO[d])
  if (dias.length === 7) return 'todos os dias'
  if (dias.length === 1) return nomes[0]

  const contiguo = dias.every((dia, i) => i === 0 || posicao(dia) === posicao(dias[i - 1]) + 1)
  if (contiguo && dias.length >= 3) return `${nomes[0]} a ${nomes.at(-1)}`

  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

/** "9h às 18h" — nunca "09:00 às 18:00", que soa a horário de trem. */
export function rotularFaixa(grupo: GrupoAberto): string {
  return `${horaCurta(grupo.abre)} às ${horaCurta(grupo.fecha)}`
}

/**
 * A frase inteira, igual à que o agente recebe pela view.
 *
 * Devolve `null` quando nada foi informado, pela mesma regra do banco.
 */
export function resumoHorario(dias: DiaFuncionamento[]): string | null {
  const { abertos, fechados } = agruparHorario(dias)
  if (abertos.length === 0) return null

  const oracoes = abertos.map((g) => `${rotularDias(g.dias)} das ${rotularFaixa(g)}`)

  if (fechados.length > 0) {
    const plural = fechados.length === 1 ? 'fechado' : 'fechados'
    oracoes.push(`${rotularDias(fechados)} ${plural}`)
  }

  return oracoes.join('; ')
}

/* ------------------------------------------------------------------ */
/* Conferência contra a janela dos corretores                          */
/* ------------------------------------------------------------------ */

export interface AvisoCobertura {
  dia: number
  texto: string
}

interface LinhaJanelaCorretor {
  dia_semana: number
  hora_inicio: string
  hora_fim: string
}

/**
 * Aponta onde o horário declarado promete mais do que a equipe cobre.
 *
 * O horário desta tela não recusa agendamento nenhum, mas o cliente lê
 * ele. Declarar "sábado até as 18h" com todos os corretores encerrando
 * às 13h produz a pior falha possível: o agente promete, o cliente pede,
 * e o banco recusa com uma mensagem que ninguém entende de onde veio.
 *
 * **Só avisa quando o declarado é mais largo.** Mais estreito é normal e
 * comum: a imobiliária abre às 9h e faz visitas a partir das 10h.
 *
 * **A comparação é por extremos, não por cobertura real.** Usa o começo
 * mais cedo e o fim mais tarde entre os corretores ativos, então um
 * buraco no meio do dia passa despercebido. Foi escolhido assim porque o
 * caso que queima é o extremo, e uma checagem de intervalos vagos
 * apontaria divergência em toda imobiliária que faz pausa de almoço.
 */
export async function conferirCoberturaCorretores(
  dias: DiaFuncionamento[],
): Promise<AvisoCobertura[]> {
  const abertos = dias.filter((d) => d.aberto)
  if (abertos.length === 0) return []

  const { data, error } = await supabase
    .from('agendas_horarios')
    .select('dia_semana, hora_inicio, hora_fim, agendas!inner(corretores!inner(ativo))')
    .eq('ativo', true)
    .eq('agendas.corretores.ativo', true)

  if (error) throw error

  const janelas = (data ?? []) as unknown as LinhaJanelaCorretor[]
  const avisos: AvisoCobertura[] = []

  for (const dia of ORDEM_SEMANA) {
    const declarado = abertos.find((d) => d.dia === dia)
    if (!declarado) continue

    const doDia = janelas.filter((j) => j.dia_semana === dia)
    const nome = NOMES_DIAS_FUNCIONAMENTO[dia]

    if (doDia.length === 0) {
      avisos.push({
        dia,
        texto: `Nenhum corretor ativo atende ${nome}, então não há visita possível nesse dia.`,
      })
      continue
    }

    const inicio = Math.min(...doDia.map((j) => minutosDeHora(j.hora_inicio)))
    const fim = Math.max(...doDia.map((j) => minutosDeHora(j.hora_fim)))

    if (minutosDeHora(declarado.abre) < inicio) {
      avisos.push({
        dia,
        texto: `${maiuscula(nome)}: você abre às ${horaCurta(declarado.abre)}, e o primeiro corretor só começa às ${horaCurta(janelaComoTexto(inicio))}.`,
      })
    }

    if (minutosDeHora(declarado.fecha) > fim) {
      avisos.push({
        dia,
        texto: `${maiuscula(nome)}: você fecha às ${horaCurta(declarado.fecha)}, e o último corretor encerra às ${horaCurta(janelaComoTexto(fim))}.`,
      })
    }
  }

  return avisos
}

function janelaComoTexto(minutos: number): string {
  const hora = Math.floor(minutos / 60)
  const minuto = minutos % 60
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
