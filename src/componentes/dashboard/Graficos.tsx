import { useId, useState } from 'react'
import { formatarNumero } from '@/lib/dashboard'
import { cn } from '@/lib/utils'

/**
 * Gráficos em SVG próprio.
 *
 * Sem biblioteca de gráficos, pela mesma razão que o projeto não usa
 * biblioteca de data nem de arrastar-e-soltar: uma dependência de
 * gráficos custa algumas centenas de kB no bundle, e o Dashboard precisa
 * de três formas simples — barras, área e rosca. O SVG resolve as três
 * em algumas dezenas de linhas, escala sozinho com a largura do
 * contêiner e não impõe um tema visual estranho ao resto do sistema.
 *
 * Todos usam `viewBox` com `preserveAspectRatio="none"` no eixo
 * horizontal, ou coordenadas percentuais, para acompanhar a largura
 * disponível sem cálculo em JavaScript nem observador de redimensionamento.
 */

/* ==================================================================== */
/* Gráfico de área com pontos por dia                                    */
/* ==================================================================== */

export interface PontoGrafico {
  rotulo: string
  valor: number
  /** Texto exibido ao passar o mouse. Cai para rótulo + valor. */
  detalhe?: string
}

/**
 * Evolução ao longo do período.
 *
 * A área embaixo da linha não é enfeite: com valores baixos — o caso de
 * uma imobiliária pequena — uma linha de 1px sobre fundo branco quase
 * desaparece, e a área dá corpo suficiente para a curva ser lida de
 * relance.
 */
export function GraficoArea({
  pontos,
  altura = 180,
  cor = 'var(--cor-destaque)',
}: {
  pontos: PontoGrafico[]
  altura?: number
  cor?: string
}) {
  const id = useId()
  const [ativo, setAtivo] = useState<number | null>(null)

  if (pontos.length === 0) return null

  const largura = 100
  const maximo = Math.max(...pontos.map((p) => p.valor), 1)

  // Um ponto só não desenha linha. Repetir o valor nas duas pontas
  // produz uma faixa horizontal, que é a leitura correta: houve isso o
  // período inteiro.
  const lista = pontos.length === 1 ? [pontos[0], pontos[0]] : pontos
  const passo = largura / (lista.length - 1)

  const coordenadas = lista.map((ponto, i) => {
    const x = i * passo
    // 4% de folga no topo para o pico não encostar na borda.
    const y = 96 - (ponto.valor / maximo) * 92
    return { x, y }
  })

  const linha = coordenadas.map(({ x, y }) => `${x},${y}`).join(' ')
  const area = `0,100 ${linha} ${largura},100`

  return (
    <div className="relative w-full" style={{ height: altura }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="size-full overflow-visible"
        role="img"
        aria-label={`Evolução no período. Máximo de ${maximo}.`}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Linhas de referência: quatro divisões horizontais. Sem elas o
            olho não consegue estimar a altura de um pico. */}
        {[0, 25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y + 4}
            y2={y + 4}
            stroke="var(--borda)"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <polygon points={area} fill={`url(#area-${id})`} />
        <polyline
          points={linha}
          fill="none"
          stroke={cor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Marcador do ponto sob o cursor */}
        {ativo !== null && coordenadas[ativo] && (
          <circle
            cx={coordenadas[ativo].x}
            cy={coordenadas[ativo].y}
            r="4"
            fill={cor}
            stroke="var(--superficie)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Faixas invisíveis de captura do mouse. Ficam fora do SVG porque
          `preserveAspectRatio="none"` distorce as coordenadas e tornaria
          o alvo de clique impreciso. */}
      <div className="absolute inset-0 flex">
        {lista.map((ponto, i) => (
          <div
            key={i}
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            className="group relative flex-1"
          >
            {ativo === i && (
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-texto px-2.5 py-1.5 text-xs font-medium text-superficie shadow-elevado">
                {ponto.detalhe ?? `${ponto.rotulo}: ${formatarNumero(ponto.valor)}`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================================================================== */
/* Barras horizontais                                                    */
/* ==================================================================== */

export interface BarraItem {
  rotulo: string
  valor: number
  cor?: string
  /** Leva a algum lugar ao clicar. */
  aoClicar?: () => void
}

/**
 * Barras horizontais.
 *
 * Horizontais e não verticais porque os rótulos são palavras — dias da
 * semana, tipos de imóvel, etapas do funil. Na vertical eles teriam de
 * ser abreviados ou girados, e rótulo girado ninguém lê.
 */
export function GraficoBarras({
  itens,
  formatarValor = formatarNumero,
  vazio = 'Nada no período',
}: {
  itens: BarraItem[]
  formatarValor?: (valor: number) => string
  vazio?: string
}) {
  const maximo = Math.max(...itens.map((i) => i.valor), 1)
  const total = itens.reduce((soma, i) => soma + i.valor, 0)

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-texto-tenue">{vazio}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item) => {
        const proporcao = (item.valor / maximo) * 100
        const conteudo = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-texto-suave">{item.rotulo}</span>
              <span className="shrink-0 font-semibold tabular-nums text-texto">
                {formatarValor(item.valor)}
              </span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-superficie-alternativa">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(proporcao, item.valor > 0 ? 3 : 0)}%`,
                  backgroundColor: item.cor ?? 'var(--cor-destaque)',
                }}
              />
            </span>
          </>
        )

        return (
          <li key={item.rotulo}>
            {item.aoClicar ? (
              <button
                type="button"
                onClick={item.aoClicar}
                className="block w-full cursor-pointer rounded-lg text-left transition-opacity hover:opacity-75"
              >
                {conteudo}
              </button>
            ) : (
              <div>{conteudo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ==================================================================== */
/* Rosca                                                                 */
/* ==================================================================== */

export interface FatiaRosca {
  rotulo: string
  valor: number
  cor: string
  aoClicar?: () => void
}

/**
 * Rosca com legenda ao lado.
 *
 * O buraco no meio carrega o total, que é a informação que o usuário
 * procura primeiro. Uma pizza cheia obrigaria a somar mentalmente as
 * fatias para saber de quantos se está falando.
 *
 * Desenhada com `stroke-dasharray` em círculos concêntricos, e não com
 * caminhos de arco: cada fatia é uma linha só, sem trigonometria, e o
 * navegador cuida da curva.
 */
export function GraficoRosca({
  fatias,
  total,
  rotuloTotal,
}: {
  fatias: FatiaRosca[]
  total: number
  rotuloTotal: string
}) {
  const [ativa, setAtiva] = useState<number | null>(null)

  const comValor = fatias.filter((f) => f.valor > 0)
  const soma = comValor.reduce((s, f) => s + f.valor, 0)

  if (soma === 0) {
    return <p className="py-8 text-center text-sm text-texto-tenue">Nada para exibir ainda</p>
  }

  const raio = 15.9155 // circunferência ≈ 100, então o dasharray vira %
  let acumulado = 0

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative shrink-0">
        <svg viewBox="0 0 42 42" className="size-40 -rotate-90" role="img" aria-label={rotuloTotal}>
          <circle cx="21" cy="21" r={raio} fill="none" stroke="var(--superficie-alternativa)" strokeWidth="5" />
          {comValor.map((fatia, i) => {
            const percentual = (fatia.valor / soma) * 100
            const traco = (
              <circle
                key={fatia.rotulo}
                cx="21"
                cy="21"
                r={raio}
                fill="none"
                stroke={fatia.cor}
                strokeWidth={ativa === i ? 6.5 : 5}
                strokeDasharray={`${percentual} ${100 - percentual}`}
                strokeDashoffset={-acumulado}
                className="cursor-pointer transition-[stroke-width]"
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
                onClick={fatia.aoClicar}
              />
            )
            acumulado += percentual
            return traco
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight tabular-nums text-texto">
            {formatarNumero(ativa !== null ? comValor[ativa].valor : total)}
          </span>
          <span className="max-w-24 truncate text-xs text-texto-suave">
            {ativa !== null ? comValor[ativa].rotulo : rotuloTotal}
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {comValor.map((fatia, i) => {
          const conteudo = (
            <>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: fatia.cor }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-left text-texto-suave">
                {fatia.rotulo}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-texto">
                {formatarNumero(fatia.valor)}
              </span>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-texto-tenue">
                {((fatia.valor / soma) * 100).toFixed(0)}%
              </span>
            </>
          )

          return (
            <li key={fatia.rotulo}>
              {fatia.aoClicar ? (
                <button
                  type="button"
                  onClick={fatia.aoClicar}
                  onMouseEnter={() => setAtiva(i)}
                  onMouseLeave={() => setAtiva(null)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    ativa === i ? 'bg-superficie-alternativa' : 'hover:bg-superficie-alternativa',
                  )}
                >
                  {conteudo}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm">{conteudo}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
