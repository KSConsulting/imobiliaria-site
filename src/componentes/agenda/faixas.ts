import type { VisitaCompleta } from '@/lib/agendamentos'

export interface Faixa {
  indice: number
  total: number
}

/**
 * Distribui visitas sobrepostas em faixas lado a lado.
 *
 * Duas visitas no mesmo horário e na mesma coluna existem de verdade:
 * dois corretores diferentes atendendo no mesmo horário aparecem juntos
 * na visão de semana. Empilhadas uma sobre a outra, a de baixo some.
 *
 * O algoritmo agrupa em cachos de visitas que se tocam, e dentro do
 * cacho aloca a primeira faixa livre.
 */
export function distribuirFaixas(visitas: VisitaCompleta[]): Map<string, Faixa> {
  const resultado = new Map<string, Faixa>()

  const ordenadas = [...visitas].sort(
    (a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime(),
  )

  let cacho: VisitaCompleta[] = []
  let fimDoCacho = 0

  const fecharCacho = () => {
    if (cacho.length === 0) return

    const fimPorFaixa: number[] = []
    const faixaDe = new Map<string, number>()

    for (const visita of cacho) {
      const inicio = new Date(visita.data_hora_inicio).getTime()
      const fim = new Date(visita.data_hora_fim).getTime()

      let faixa = fimPorFaixa.findIndex((fimAnterior) => fimAnterior <= inicio)
      if (faixa === -1) faixa = fimPorFaixa.length

      fimPorFaixa[faixa] = fim
      faixaDe.set(visita.id, faixa)
    }

    for (const visita of cacho) {
      resultado.set(visita.id, {
        indice: faixaDe.get(visita.id) ?? 0,
        total: fimPorFaixa.length,
      })
    }

    cacho = []
  }

  for (const visita of ordenadas) {
    const inicio = new Date(visita.data_hora_inicio).getTime()
    const fim = new Date(visita.data_hora_fim).getTime()

    if (cacho.length > 0 && inicio >= fimDoCacho) fecharCacho()

    cacho.push(visita)
    fimDoCacho = Math.max(fimDoCacho, fim)
  }
  fecharCacho()

  return resultado
}
