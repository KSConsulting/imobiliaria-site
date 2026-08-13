import type { VisitaCompleta } from '@/lib/agendamentos'
import { comOpacidade } from '@/lib/coresCorretores'
import {
  chaveDoDia,
  inicioDaSemana,
  NOMES_DIAS_CURTOS,
  partesNoFuso,
  somarDias,
} from '@/lib/datas'
import { cn } from '@/lib/utils'

interface Props {
  mes: Date
  fuso: string
  visitas: VisitaCompleta[]
  aoAbrirDia: (dia: Date) => void
}

/**
 * Visão de mês — panorama.
 *
 * Não tenta mostrar os blocos: em célula de calendário mensal, seis
 * visitas viram seis riscos ilegíveis. Mostra a contagem e um ponto por
 * corretor envolvido, que é o suficiente para decidir em qual dia vale
 * entrar.
 */
export function VisaoMes({ mes, fuso, visitas, aoAbrirDia }: Props) {
  const hoje = chaveDoDia(new Date(), fuso)
  const mesAtual = partesNoFuso(mes, fuso).mes

  // Seis semanas cobrem qualquer mês, inclusive os que começam no sábado.
  const primeiraCelula = inicioDaSemana(mes, fuso)
  const dias = Array.from({ length: 42 }, (_, i) => somarDias(primeiraCelula, i, fuso))

  const porDia = new Map<string, VisitaCompleta[]>()
  for (const visita of visitas) {
    const chave = chaveDoDia(new Date(visita.data_hora_inicio), fuso)
    porDia.set(chave, [...(porDia.get(chave) ?? []), visita])
  }

  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
      <div className="grid grid-cols-7 border-b border-borda bg-superficie-alternativa">
        {NOMES_DIAS_CURTOS.map((nome) => (
          <div
            key={nome}
            className="px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-texto-tenue"
          >
            {nome}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const chave = chaveDoDia(dia, fuso)
          const partes = partesNoFuso(dia, fuso)
          // Sem filtro próprio de status: quem decide o que entra na
          // grade é a Agenda, para as três visões concordarem. Este
          // componente já descartava canceladas por conta própria, e
          // depois que o padrão da página passou a fazer o mesmo isso
          // virou uma regra em dois lugares — com o efeito de escolher
          // "Só canceladas" no filtro e o mês aparecer vazio.
          const doDia = porDia.get(chave) ?? []
          const doOutroMes = partes.mes !== mesAtual
          const ehHoje = chave === hoje

          // No máximo quatro pontos: além disso a contagem já informa.
          const cores = [...new Set(doDia.map((v) => v.corretores?.cor ?? '#57534E'))].slice(0, 4)

          return (
            <button
              key={chave}
              type="button"
              onClick={() => aoAbrirDia(dia)}
              className={cn(
                'flex min-h-24 cursor-pointer flex-col gap-1.5 border-b border-l border-borda p-2 text-left transition-colors first:border-l-0 hover:bg-destaque-suave/50',
                doOutroMes && 'bg-superficie-alternativa/50',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  ehHoje
                    ? 'bg-destaque text-destaque-contraste'
                    : doOutroMes
                      ? 'text-texto-tenue'
                      : 'text-texto',
                )}
              >
                {partes.dia}
              </span>

              {doDia.length > 0 && (
                <>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      doOutroMes ? 'text-texto-tenue' : 'text-texto-suave',
                    )}
                  >
                    {doDia.length} {doDia.length === 1 ? 'visita' : 'visitas'}
                  </span>

                  <span className="flex flex-wrap gap-1">
                    {cores.map((cor) => (
                      <span
                        key={cor}
                        className="size-2 rounded-full"
                        style={{ backgroundColor: doOutroMes ? comOpacidade(cor, 0.45) : cor }}
                      />
                    ))}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
