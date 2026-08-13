/**
 * Datas e fuso horário.
 *
 * Tudo em `agendamentos` é `timestamptz`, ou seja, um instante absoluto.
 * O que o usuário vê e digita é hora de parede no fuso da imobiliária
 * (`configuracoes.fuso_horario`). Converter entre os dois é o trabalho
 * deste arquivo.
 *
 * Por que não usar simplesmente a hora local do navegador: os triggers
 * de conflito e de janela de atendimento convertem usando o fuso da
 * tabela `configuracoes`. Se a máquina do operador estiver em outro
 * fuso, a interface ofereceria um horário que o banco recusa, com uma
 * mensagem que não faria sentido nenhum para quem está na tela.
 */

export const FUSO_PADRAO = 'America/Sao_Paulo'

export const NOMES_DIAS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

export const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const NOMES_DIAS_MINIMOS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export interface PartesData {
  ano: number
  mes: number // 1 a 12
  dia: number
  hora: number
  minuto: number
  diaSemana: number // 0 = domingo, mesma convenção de agendas_horarios
}

/** Decompõe um instante em hora de parede no fuso informado. */
export function partesNoFuso(instante: Date, fuso: string): PartesData {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })

  const partes: Record<string, string> = {}
  for (const parte of formatador.formatToParts(instante)) {
    partes[parte.type] = parte.value
  }

  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    // 'hour' vem como "24" à meia-noite em alguns runtimes com hour12:false
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    diaSemana: dias[partes.weekday] ?? 0,
  }
}

/** Deslocamento do fuso, em milissegundos, para um dado instante. */
function deslocamento(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso)
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, instante.getUTCSeconds())
  return comoUtc - instante.getTime()
}

/**
 * Converte hora de parede no fuso para o instante absoluto.
 *
 * Faz duas passadas porque o deslocamento depende do próprio instante
 * que estamos calculando. A segunda corrige a virada de horário de
 * verão. O Brasil não tem mais DST desde 2019, mas o sistema é
 * replicável e o custo de estar certo aqui é uma linha.
 */
export function instanteDe(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  fuso: string,
): Date {
  const chute = Date.UTC(ano, mes - 1, dia, hora, minuto)
  const primeiro = deslocamento(new Date(chute), fuso)
  let resultado = chute - primeiro

  const segundo = deslocamento(new Date(resultado), fuso)
  if (segundo !== primeiro) resultado = chute - segundo

  return new Date(resultado)
}

/** Meia-noite do dia, no fuso. */
export function inicioDoDia(instante: Date, fuso: string): Date {
  const p = partesNoFuso(instante, fuso)
  return instanteDe(p.ano, p.mes, p.dia, 0, 0, fuso)
}

/** Domingo da semana do instante — mesma convenção de `dia_semana`. */
export function inicioDaSemana(instante: Date, fuso: string): Date {
  const p = partesNoFuso(instante, fuso)
  const meiaNoite = instanteDe(p.ano, p.mes, p.dia, 0, 0, fuso)
  return somarDias(meiaNoite, -p.diaSemana, fuso)
}

export function inicioDoMes(instante: Date, fuso: string): Date {
  const p = partesNoFuso(instante, fuso)
  return instanteDe(p.ano, p.mes, 1, 0, 0, fuso)
}

/**
 * Soma dias preservando a hora de parede.
 *
 * Somar 86.400.000 ms daria errado na virada de horário de verão: o dia
 * seguinte às 10h passaria a ser 9h ou 11h.
 */
export function somarDias(instante: Date, dias: number, fuso: string): Date {
  const p = partesNoFuso(instante, fuso)
  return instanteDe(p.ano, p.mes, p.dia + dias, p.hora, p.minuto, fuso)
}

export function somarMeses(instante: Date, meses: number, fuso: string): Date {
  const p = partesNoFuso(instante, fuso)
  return instanteDe(p.ano, p.mes + meses, 1, 0, 0, fuso)
}

export function somarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000)
}

/** Mesmo dia do calendário, no fuso. */
export function mesmoDia(a: Date, b: Date, fuso: string): boolean {
  const pa = partesNoFuso(a, fuso)
  const pb = partesNoFuso(b, fuso)
  return pa.ano === pb.ano && pa.mes === pb.mes && pa.dia === pb.dia
}

/** Chave `AAAA-MM-DD` no fuso, para agrupar por dia. */
export function chaveDoDia(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/** Minutos desde a meia-noite, no fuso. */
export function minutosDoDia(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso)
  return p.hora * 60 + p.minuto
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

/** 14:30 */
export function formatarHora(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/** 10/08/2026 */
export function formatarData(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}/${p.ano}`
}

/** segunda-feira, 10 de agosto */
export function formatarDataPorExtenso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${NOMES_DIAS[p.diaSemana]}, ${p.dia} de ${NOMES_MESES[p.mes - 1]}`
}

/** 10/08/2026, 14:30 às 15:00 */
export function formatarIntervalo(inicio: Date, fim: Date, fuso: string): string {
  return `${formatarData(inicio, fuso)}, ${formatarHora(inicio, fuso)} às ${formatarHora(fim, fuso)}`
}

/** "09:00" a partir de minutos desde a meia-noite. */
export function horaDeMinutos(minutos: number): string {
  const hora = Math.floor(minutos / 60)
  const minuto = minutos % 60
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

/** "09:00:00" ou "09:00" → 540 */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m ?? 0)
}

/** "9h", "14h30" — usado no resumo da janela de atendimento. */
export function horaCurta(hora: string): string {
  const minutos = minutosDeHora(hora)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Fuso do navegador, para avisar quando divergir do configurado. */
export function fusoDoNavegador(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * "agora mesmo", "há 3 horas", "há 12 dias".
 *
 * Recebe o instante e recalcula na hora de exibir, em vez de ler
 * `crm_imobiliaria.minutos_ultima_mensagem`. Aquela coluna é gravada
 * pelo trigger 9 no momento em que `ultima_mensagem` muda: é um retrato,
 * não um relógio. Um lead parado há três dias continuaria mostrando "há
 * 2 minutos" para sempre, que é justamente o lead que ninguém pode
 * deixar esfriar. A coluna segue existindo para a API — ver BANCO.md.
 *
 * O cálculo é sobre instantes absolutos, então independe de fuso.
 */
export function tempoRelativo(instante: Date | string | null | undefined): string {
  if (!instante) return '—'

  const data = instante instanceof Date ? instante : new Date(instante)
  if (Number.isNaN(data.getTime())) return '—'

  const minutos = Math.floor((Date.now() - data.getTime()) / 60_000)

  // Relógio do servidor adiantado em relação ao do navegador produz
  // diferença negativa. "em 2 minutos" não faz sentido nenhum aqui.
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`

  const dias = Math.floor(horas / 24)
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`

  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`

  const anos = Math.floor(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

/** 10/08/2026, 14:30 — data e hora numa linha só. */
export function formatarDataHora(instante: Date, fuso: string): string {
  return `${formatarData(instante, fuso)}, ${formatarHora(instante, fuso)}`
}
