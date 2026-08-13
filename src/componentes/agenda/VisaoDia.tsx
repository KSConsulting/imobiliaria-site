import { BlocoVisita } from '@/componentes/agenda/BlocoVisita'
import {
  GradeHorarios,
  posicaoDoBloco,
  type Coluna,
} from '@/componentes/agenda/GradeHorarios'
import { distribuirFaixas } from '@/componentes/agenda/faixas'
import { DURACAO_VISITA, type VisitaCompleta } from '@/lib/agendamentos'
import { janelaDoDia, type CorretorCompleto } from '@/lib/corretores'
import { corDoTextoSobre } from '@/lib/coresCorretores'
import { inicioDoDia, minutosDoDia, partesNoFuso } from '@/lib/datas'

interface Props {
  dia: Date
  fuso: string
  visitas: VisitaCompleta[]
  corretores: CorretorCompleto[]
  minutoInicio: number
  minutoFim: number
  recemChegadas: Set<string>
  aoClicarVazio: (instante: Date, idCorretor: string) => void
  aoAbrirVisita: (visita: VisitaCompleta) => void
  aoIniciarArrasto: (visita: VisitaCompleta) => void
  aoTerminarArrasto: () => void
  /** Soltar em outra coluna troca o corretor responsável. */
  aoSoltar: (instante: Date, idCorretor: string) => void
}

/**
 * Visão de dia — uma coluna por corretor.
 *
 * É a visão que responde "quem está livre agora?": lado a lado, dá para
 * ver de relance quem tem buraco na agenda. Também é a única em que
 * arrastar troca o corretor responsável, e não o horário.
 */
export function VisaoDia({
  dia,
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
  const meiaNoite = inicioDoDia(dia, fuso)
  const diaSemana = partesNoFuso(dia, fuso).diaSemana
  const ehHoje = inicioDoDia(agora, fuso).getTime() === meiaNoite.getTime()

  const colunas: Coluna[] = corretores.map((corretor) => ({
    chave: corretor.id,
    cabecalho: (
      <div className="flex items-center justify-center gap-2">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold"
          style={{ backgroundColor: corretor.cor, color: corDoTextoSobre(corretor.cor) }}
        >
          {corretor.nome.charAt(0).toUpperCase()}
          {corretor.sobrenome.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-xs font-semibold text-texto">
          {corretor.nome} {corretor.sobrenome.charAt(0)}.
        </span>
      </div>
    ),
  }))

  const porCorretor = new Map<string, VisitaCompleta[]>()
  for (const visita of visitas) {
    porCorretor.set(visita.id_corretor, [
      ...(porCorretor.get(visita.id_corretor) ?? []),
      visita,
    ])
  }

  function foraDaJanela(idCorretor: string, minuto: number): boolean {
    const corretor = corretores.find((c) => c.id === idCorretor)
    if (!corretor) return true
    const janela = janelaDoDia(corretor, diaSemana)
    return !janela || minuto < janela.inicio || minuto + DURACAO_VISITA > janela.fim
  }

  const instanteDoSlot = (minuto: number) => new Date(meiaNoite.getTime() + minuto * 60_000)

  return (
    <GradeHorarios
      colunas={colunas}
      minutoInicio={minutoInicio}
      minutoFim={minutoFim}
      foraDaJanela={foraDaJanela}
      aoClicarSlot={(idCorretor, minuto) => aoClicarVazio(instanteDoSlot(minuto), idCorretor)}
      aoSoltarEmSlot={(idCorretor, minuto) => aoSoltar(instanteDoSlot(minuto), idCorretor)}
      minutoAgora={
        ehHoje
          ? { chaveColuna: corretores[0]?.id ?? '', minuto: minutosDoDia(agora, fuso) }
          : null
      }
      conteudoDaColuna={(idCorretor) => {
        const doCorretor = porCorretor.get(idCorretor) ?? []
        const faixas = distribuirFaixas(doCorretor)

        return doCorretor.map((visita) => {
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
