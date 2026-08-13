import { BlocoVisita } from '@/componentes/agenda/BlocoVisita'
import {
  GradeHorarios,
  posicaoDoBloco,
  type Coluna,
} from '@/componentes/agenda/GradeHorarios'
import { distribuirFaixas } from '@/componentes/agenda/faixas'
import { DURACAO_VISITA, type VisitaCompleta } from '@/lib/agendamentos'
import { janelaDoDia, type CorretorCompleto } from '@/lib/corretores'
import {
  chaveDoDia,
  minutosDoDia,
  NOMES_DIAS_CURTOS,
  partesNoFuso,
  somarDias,
} from '@/lib/datas'
import { cn } from '@/lib/utils'

interface Props {
  inicioDaSemana: Date
  fuso: string
  visitas: VisitaCompleta[]
  corretores: CorretorCompleto[]
  minutoInicio: number
  minutoFim: number
  recemChegadas: Set<string>
  aoClicarVazio: (instante: Date) => void
  aoAbrirVisita: (visita: VisitaCompleta) => void
  aoIniciarArrasto: (visita: VisitaCompleta) => void
  aoTerminarArrasto: () => void
  /** O pai sabe qual visita está sendo arrastada e resolve o destino. */
  aoSoltar: (instante: Date) => void
}

/**
 * Visão de semana — a padrão.
 *
 * Sete colunas de dia, linhas de 30 minutos. É a visão mais útil no dia
 * a dia de imobiliária: mostra a semana inteira do time de uma vez.
 */
export function VisaoSemana({
  inicioDaSemana,
  fuso,
  visitas,
  corretores,
  minutoInicio,
  minutoFim,
  recemChegadas,
  aoClicarVazio,
  aoAbrirVisita,
  aoIniciarArrasto,
  aoTerminarArrasto,
  aoSoltar,
}: Props) {
  const agora = new Date()
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana, i, fuso))

  const colunas: Coluna[] = dias.map((dia) => {
    const partes = partesNoFuso(dia, fuso)
    const hoje = chaveDoDia(dia, fuso) === chaveDoDia(agora, fuso)

    return {
      chave: chaveDoDia(dia, fuso),
      destacada: hoje,
      cabecalho: (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texto-tenue">
            {NOMES_DIAS_CURTOS[partes.diaSemana]}
          </span>
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-sm font-semibold',
              hoje ? 'bg-destaque text-destaque-contraste' : 'text-texto',
            )}
          >
            {partes.dia}
          </span>
        </div>
      ),
    }
  })

  const porDia = new Map<string, VisitaCompleta[]>()
  for (const visita of visitas) {
    const chave = chaveDoDia(new Date(visita.data_hora_inicio), fuso)
    porDia.set(chave, [...(porDia.get(chave) ?? []), visita])
  }

  /**
   * Sombreia o slot quando NENHUM corretor visível atende naquele
   * horário — não faz sentido convidar o clique num horário em que a
   * equipe inteira está fora da janela.
   */
  function foraDaJanela(chaveColuna: string, minuto: number): boolean {
    const dia = dias.find((d) => chaveDoDia(d, fuso) === chaveColuna)
    if (!dia) return false
    const diaSemana = partesNoFuso(dia, fuso).diaSemana

    return !corretores.some((corretor) => {
      const janela = janelaDoDia(corretor, diaSemana)
      return janela && minuto >= janela.inicio && minuto + DURACAO_VISITA <= janela.fim
    })
  }

  /** `dia` é meia-noite no fuso, então somar minutos é seguro dentro dele. */
  function instanteDoSlot(chaveColuna: string, minuto: number): Date | null {
    const dia = dias.find((d) => chaveDoDia(d, fuso) === chaveColuna)
    return dia ? new Date(dia.getTime() + minuto * 60_000) : null
  }

  return (
    <GradeHorarios
      colunas={colunas}
      minutoInicio={minutoInicio}
      minutoFim={minutoFim}
      foraDaJanela={foraDaJanela}
      aoClicarSlot={(chave, minuto) => {
        const instante = instanteDoSlot(chave, minuto)
        if (instante) aoClicarVazio(instante)
      }}
      aoSoltarEmSlot={(chave, minuto) => {
        const instante = instanteDoSlot(chave, minuto)
        if (instante) aoSoltar(instante)
      }}
      minutoAgora={{ chaveColuna: chaveDoDia(agora, fuso), minuto: minutosDoDia(agora, fuso) }}
      conteudoDaColuna={(chave) => {
        const doDia = porDia.get(chave) ?? []
        const faixas = distribuirFaixas(doDia)

        return doDia.map((visita) => {
          const inicio = new Date(visita.data_hora_inicio)
          const duracao = Math.max(
            DURACAO_VISITA,
            (new Date(visita.data_hora_fim).getTime() - inicio.getTime()) / 60_000,
          )

          return (
            <BlocoVisita
              key={visita.id}
              visita={visita}
              fuso={fuso}
              recemChegada={recemChegadas.has(visita.id)}
              estilo={posicaoDoBloco(
                minutosDoDia(inicio, fuso),
                duracao,
                minutoInicio,
                faixas.get(visita.id),
              )}
              aoAbrir={aoAbrirVisita}
              aoIniciarArrasto={aoIniciarArrasto}
              aoTerminarArrasto={aoTerminarArrasto}
            />
          )
        })
      }}
    />
  )
}
