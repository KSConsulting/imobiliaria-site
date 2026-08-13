/**
 * Conversão de fuso e escrita de datas por extenso.
 *
 * A conversão é a mesma de `src/lib/datas.ts`, portada em vez de
 * importada — o frontend e a Edge Function são runtimes diferentes e não
 * compartilham módulos. **As duas precisam continuar concordando**: os
 * triggers 4 e 5 convertem pelo fuso de `configuracoes`, e um cálculo
 * divergente aqui ofereceria ao agente horários que o banco recusa.
 *
 * A parte nova é a escrita por extenso. Ela existe porque a `mensagem`
 * da API vai direto para o WhatsApp do cliente: "quinta-feira, 14/08, às
 * 15h" é o que uma pessoa lê; "2026-08-14T18:00:00Z" é o que ninguém lê.
 */

export interface PartesData {
  ano: number
  mes: number
  dia: number
  hora: number
  minuto: number
  /** 0 = domingo, mesma convenção de `agendas_horarios.dia_semana`. */
  diaSemana: number
}

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
  for (const parte of formatador.formatToParts(instante)) partes[parte.type] = parte.value

  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    diaSemana: dias[partes.weekday] ?? 0,
  }
}

function deslocamento(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso)
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, instante.getUTCSeconds())
  return comoUtc - instante.getTime()
}

/**
 * Hora de parede no fuso → instante absoluto.
 *
 * Duas passadas porque o deslocamento depende do próprio instante que
 * está sendo calculado. A segunda corrige a virada de horário de verão.
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

/** Minutos desde a meia-noite, no fuso. */
export function minutosDoDia(instante: Date, fuso: string): number {
  const p = partesNoFuso(instante, fuso)
  return p.hora * 60 + p.minuto
}

/** `"09:00"` ou `"09:00:00"` → 540. */
export function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}

export const NOMES_DIAS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

/* ------------------------------------------------------------------ */
/* Entrada: o que o agente manda                                       */
/* ------------------------------------------------------------------ */

/** `"2026-08-14"` → `{ano, mes, dia}`. Devolve `null` se não for uma data real. */
export function lerData(valor: unknown): { ano: number; mes: number; dia: number } | null {
  if (typeof valor !== 'string') return null
  const casamento = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!casamento) return null

  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  const dia = Number(casamento[3])

  // Rejeita 31/02 e afins: `Date` normalizaria para 03/03 em silêncio, e
  // a visita seria marcada num dia que ninguém pediu.
  const teste = new Date(Date.UTC(ano, mes - 1, dia))
  if (teste.getUTCMonth() + 1 !== mes || teste.getUTCDate() !== dia) return null

  return { ano, mes, dia }
}

/**
 * `"15:00"`, `"15h"`, `"15"` → minutos desde a meia-noite.
 *
 * Aceita as três formas porque a hora chega de um modelo de linguagem
 * transcrevendo o que uma pessoa falou, e "às 15h" é o que ela fala.
 * Recusar por formato aqui empurraria o agente a inventar o horário.
 */
export function lerHora(valor: unknown): number | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim().toLowerCase().replace(/\s/g, '')

  const comMinutos = limpo.match(/^(\d{1,2})[:h](\d{2})$/)
  if (comMinutos) return validarMinutos(Number(comMinutos[1]), Number(comMinutos[2]))

  const soHora = limpo.match(/^(\d{1,2})h?$/)
  if (soHora) return validarMinutos(Number(soHora[1]), 0)

  return null
}

function validarMinutos(hora: number, minuto: number): number | null {
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null
  return hora * 60 + minuto
}

/* ------------------------------------------------------------------ */
/* Saída: o que a pessoa lê no WhatsApp                                */
/* ------------------------------------------------------------------ */

/** `15h` ou `15h30` — nunca `15:00`, que soa a horário de trem. */
export function horaFalada(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return p.minuto === 0 ? `${p.hora}h` : `${p.hora}h${String(p.minuto).padStart(2, '0')}`
}

/** `quinta-feira, 14/08, às 15h` */
export function porExtenso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  const dia = String(p.dia).padStart(2, '0')
  const mes = String(p.mes).padStart(2, '0')
  return `${NOMES_DIAS[p.diaSemana]}, ${dia}/${mes}, às ${horaFalada(instante, fuso)}`
}

/** `quinta às 15h` — a forma curta, para listas de alternativas. */
export function curtoFalado(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  const dia = NOMES_DIAS[p.diaSemana].replace('-feira', '')
  return `${dia} às ${horaFalada(instante, fuso)}`
}

/** `14/08` */
export function dataCurta(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  return `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Saída: o que o N8N usa                                              */
/* ------------------------------------------------------------------ */

/**
 * `2026-08-13T15:00:00-03:00` — ISO 8601 com o deslocamento do fuso da
 * imobiliária.
 *
 * É para o fluxo, não para a conversa: quem lê a data no WhatsApp lê
 * `porExtenso`. Um campo só, e não `data` + `hora` separados, porque o
 * destino é um nó de calendário ou de espera, e todos eles pedem um
 * instante — remontá-lo concatenando dois campos é trabalho que o
 * consumidor não deveria ter.
 *
 * **Com deslocamento, nunca em UTC (`…T18:00:00Z`).** Os dois descrevem o
 * mesmo instante, mas só este preserva a hora de parede legível dentro da
 * própria string. Em UTC, qualquer leitura que não converta de volta
 * mostra 18h para uma visita das 15h, e o erro é do tipo que passa
 * despercebido até alguém aparecer três horas atrasado.
 */
export function timestampNoFuso(instante: Date, fuso: string): string {
  const p = partesNoFuso(instante, fuso)
  const dd = (n: number) => String(n).padStart(2, '0')

  // O mesmo deslocamento que `instanteDe` usa para converter, escrito
  // como `-03:00`. Lido do fuso e não fixado, porque ele muda com o
  // horário de verão e com a imobiliária.
  const minutos = Math.round(deslocamento(instante, fuso) / 60_000)
  const sinal = minutos < 0 ? '-' : '+'
  const absoluto = Math.abs(minutos)

  return (
    `${p.ano}-${dd(p.mes)}-${dd(p.dia)}` +
    `T${dd(p.hora)}:${dd(p.minuto)}:00` +
    `${sinal}${dd(Math.floor(absoluto / 60))}:${dd(absoluto % 60)}`
  )
}

/**
 * Junta uma lista em português: `"a, b ou c"`.
 *
 * O conector é `ou` e não `e` porque a lista quase sempre é de opções
 * entre as quais a pessoa vai escolher uma.
 */
export function listar(itens: string[], conector = 'ou'): string {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  return `${itens.slice(0, -1).join(', ')} ${conector} ${itens[itens.length - 1]}`
}
