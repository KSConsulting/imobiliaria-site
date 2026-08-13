import { Building2, CalendarCheck, Eye, TrendingDown, TrendingUp, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/componentes/ui/skeleton'
import { formatarNumero, formatarPercentual, variacao, type Indicadores } from '@/lib/dashboard'
import { cn } from '@/lib/utils'

interface Props {
  dados: Indicadores | null
  carregando: boolean
  rotuloPeriodo: string
}

/**
 * A faixa fixa, acima das abas.
 *
 * Fica fora das abas porque estes quatro números respondem à pergunta
 * que o dono faz ao abrir o painel, antes de decidir o que investigar.
 * Dentro de uma aba, metade deles ficaria escondida atrás de um clique
 * que ninguém dá.
 *
 * É também o bloco que carrega primeiro: o Dashboard é a primeira tela
 * depois do login, e é ela que define a percepção de velocidade do
 * sistema inteiro.
 */
export function FaixaIndicadores({ dados, carregando, rotuloPeriodo }: Props) {
  if (carregando || !dados) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cartao flex flex-col gap-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Cartao
        icone={UserPlus}
        rotulo="Leads novos"
        valor={dados.leads_novos}
        anterior={dados.leads_novos_anterior}
        rotuloPeriodo={rotuloPeriodo}
      />
      <Cartao
        icone={CalendarCheck}
        rotulo="Visitas"
        valor={dados.visitas}
        anterior={dados.visitas_anterior}
        rotuloPeriodo={rotuloPeriodo}
      />
      <Cartao
        icone={Eye}
        rotulo="Visitas no site"
        valor={dados.visitas_site}
        anterior={dados.visitas_site_anterior}
        rotuloPeriodo={rotuloPeriodo}
      />

      {/* Estoque é retrato do agora. No lugar da variação — que não faria
          sentido contra "o período anterior" — vai a divisão entre venda
          e locação, que é o recorte que o dono usa para decidir onde
          faltam imóveis. */}
      <Cartao
        icone={Building2}
        rotulo="Imóveis ativos"
        valor={dados.imoveis_ativos}
        rodape={
          dados.imoveis_ativos > 0 ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
              <span>
                <strong className="font-semibold text-texto">
                  {formatarNumero(dados.imoveis_venda)}
                </strong>{' '}
                à venda
              </span>
              <span>
                <strong className="font-semibold text-texto">
                  {formatarNumero(dados.imoveis_locacao)}
                </strong>{' '}
                para alugar
              </span>
            </span>
          ) : (
            <span className="text-xs text-texto-tenue">Nenhum imóvel publicado</span>
          )
        }
        legenda="Agora"
      />
    </div>
  )
}

function Cartao({
  icone: Icone,
  rotulo,
  valor,
  anterior,
  rodape,
  legenda,
  rotuloPeriodo,
}: {
  icone: LucideIcon
  rotulo: string
  valor: number
  anterior?: number
  rodape?: React.ReactNode
  legenda?: string
  rotuloPeriodo?: string
}) {
  return (
    <article className="cartao flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-texto-suave">{rotulo}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-superficie-alternativa">
          <Icone className="size-4 text-texto-tenue" strokeWidth={1.9} />
        </span>
      </div>

      <span className="text-3xl font-bold tracking-tight tabular-nums text-texto">
        {formatarNumero(valor)}
      </span>

      {rodape ?? (
        <Variacao atual={valor} anterior={anterior ?? 0} rotuloPeriodo={rotuloPeriodo} />
      )}

      {legenda && (
        <span className="-mt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-texto-tenue">
          {legenda}
        </span>
      )}
    </article>
  )
}

/**
 * A seta de variação.
 *
 * Número sozinho não informa: 40 leads é bom ou ruim dependendo de
 * quantos foram no período anterior.
 *
 * Sem base de comparação, diz isso com palavras. "Alta de 0%" seria
 * falso e "alta de ∞%" seria inútil — sair de zero para doze leads é a
 * primeira medição, não um crescimento.
 */
function Variacao({
  atual,
  anterior,
  rotuloPeriodo,
}: {
  atual: number
  anterior: number
  rotuloPeriodo?: string
}) {
  const percentual = variacao(atual, anterior)

  if (percentual === null) {
    return (
      <span className="text-xs text-texto-tenue">
        {atual > 0 ? 'Sem base de comparação anterior' : 'Nada registrado no período'}
      </span>
    )
  }

  const subiu = percentual > 0
  const estavel = Math.abs(percentual) < 0.05

  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
          estavel
            ? 'bg-superficie-alternativa text-texto-suave'
            : subiu
              ? 'bg-sucesso/12 text-sucesso'
              : 'bg-destrutivo/10 text-destrutivo',
        )}
      >
        {!estavel &&
          (subiu ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />)}
        {estavel ? 'estável' : formatarPercentual(Math.abs(percentual))}
      </span>
      <span className="text-texto-tenue">
        vs. {formatarNumero(anterior)} {rotuloPeriodo ? 'no período anterior' : 'antes'}
      </span>
    </span>
  )
}
