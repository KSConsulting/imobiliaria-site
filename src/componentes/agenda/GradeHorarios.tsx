import type { ReactNode } from 'react'
import { horaDeMinutos } from '@/lib/datas'
import { cn } from '@/lib/utils'

/** Altura de um bloco de 30 minutos, em pixels. */
export const ALTURA_SLOT = 44
export const MINUTOS_SLOT = 30
/** Largura da régua de horários à esquerda. */
export const LARGURA_REGUA = 56

export interface Coluna {
  chave: string
  /** Conteúdo do cabeçalho da coluna. */
  cabecalho: ReactNode
  /** Destaque de coluna, usado no dia de hoje. */
  destacada?: boolean
}

interface Props {
  colunas: Coluna[]
  /** Primeiro e último minuto exibidos, contados da meia-noite. */
  minutoInicio: number
  minutoFim: number
  /** Sombreia os slots fora da janela de atendimento. */
  foraDaJanela?: (chaveColuna: string, minuto: number) => boolean
  aoClicarSlot: (chaveColuna: string, minuto: number) => void
  aoSoltarEmSlot?: (chaveColuna: string, minuto: number) => void
  /** Blocos posicionados em absoluto, por coluna. */
  conteudoDaColuna: (chaveColuna: string) => ReactNode
  /** Linha do "agora", quando o instante cai na faixa visível. */
  minutoAgora?: { chaveColuna: string; minuto: number } | null
}

/**
 * Grade de horários compartilhada pelas visões de semana e de dia.
 *
 * A única diferença entre as duas é o que cada coluna representa: dias
 * da semana numa, corretores na outra. O resto — régua, slots de 30
 * minutos, clique no vazio, alvo de soltura — é idêntico, então mora
 * aqui em vez de ser duplicado.
 */
export function GradeHorarios({
  colunas,
  minutoInicio,
  minutoFim,
  foraDaJanela,
  aoClicarSlot,
  aoSoltarEmSlot,
  conteudoDaColuna,
  minutoAgora,
}: Props) {
  const slots: number[] = []
  for (let minuto = minutoInicio; minuto < minutoFim; minuto += MINUTOS_SLOT) slots.push(minuto)

  const altura = slots.length * ALTURA_SLOT

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* ---------------- Cabeçalho ---------------- */}
        <div
          className="sticky top-16 z-20 flex border-b border-borda bg-superficie/95 backdrop-blur-md"
          style={{ paddingLeft: LARGURA_REGUA }}
        >
          {colunas.map((coluna) => (
            <div
              key={coluna.chave}
              className={cn(
                'min-w-32 flex-1 border-l border-borda px-2 py-2.5 text-center',
                coluna.destacada && 'bg-destaque-suave',
              )}
            >
              {coluna.cabecalho}
            </div>
          ))}
        </div>

        {/* ---------------- Corpo ---------------- */}
        <div className="flex" style={{ height: altura }}>
          {/* Régua */}
          <div className="shrink-0" style={{ width: LARGURA_REGUA }}>
            {slots.map((minuto) => (
              <div
                key={minuto}
                style={{ height: ALTURA_SLOT }}
                className="relative border-b border-transparent"
              >
                {/* Só a hora cheia recebe rótulo: meia hora polui. */}
                {minuto % 60 === 0 && (
                  <span className="absolute -top-2 right-2 text-[0.6875rem] font-medium text-texto-tenue">
                    {horaDeMinutos(minuto)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Colunas */}
          {colunas.map((coluna) => (
            <div
              key={coluna.chave}
              className={cn(
                'relative min-w-32 flex-1 border-l border-borda',
                coluna.destacada && 'bg-destaque-suave/35',
              )}
            >
              {slots.map((minuto) => {
                const bloqueado = foraDaJanela?.(coluna.chave, minuto) ?? false
                return (
                  <div
                    key={minuto}
                    onClick={() => aoClicarSlot(coluna.chave, minuto)}
                    onDragOver={(e) => {
                      if (aoSoltarEmSlot) e.preventDefault()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      aoSoltarEmSlot?.(coluna.chave, minuto)
                    }}
                    style={{ height: ALTURA_SLOT }}
                    className={cn(
                      'cursor-pointer border-b transition-colors',
                      minuto % 60 === 0 ? 'border-borda' : 'border-borda/45',
                      bloqueado
                        ? 'bg-superficie-alternativa/70 hover:bg-superficie-alternativa'
                        : 'hover:bg-destaque-suave/60',
                    )}
                  />
                )
              })}

              {/* Linha do agora */}
              {minutoAgora?.chaveColuna === coluna.chave &&
                minutoAgora.minuto >= minutoInicio &&
                minutoAgora.minuto < minutoFim && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{
                      top: ((minutoAgora.minuto - minutoInicio) / MINUTOS_SLOT) * ALTURA_SLOT,
                    }}
                  >
                    <span className="size-2 shrink-0 rounded-full bg-destrutivo" />
                    <span className="h-px flex-1 bg-destrutivo" />
                  </div>
                )}

              {conteudoDaColuna(coluna.chave)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Posição absoluta de um bloco dentro da coluna. */
export function posicaoDoBloco(
  minutoDaVisita: number,
  duracao: number,
  minutoInicio: number,
  faixa: { indice: number; total: number } = { indice: 0, total: 1 },
): React.CSSProperties {
  const largura = 100 / faixa.total
  return {
    top: ((minutoDaVisita - minutoInicio) / MINUTOS_SLOT) * ALTURA_SLOT + 1,
    height: (duracao / MINUTOS_SLOT) * ALTURA_SLOT - 3,
    left: `calc(${faixa.indice * largura}% + 2px)`,
    width: `calc(${largura}% - 4px)`,
  }
}
