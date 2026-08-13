import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Hammer } from 'lucide-react'

interface Props {
  icone?: LucideIcon
  titulo: string
  descricao: string
  etapa: number
  /** Recursos previstos para a tela, listados como referência. */
  previsto?: string[]
  /** Conteúdo já funcional acima do aviso, como o alternador Leads/Funil. */
  acoes?: ReactNode
}

/**
 * Placeholder das telas que serão construídas nas etapas seguintes.
 *
 * O objetivo desta etapa é o sistema navegável de ponta a ponta: toda
 * rota existe e responde, nenhuma leva a uma tela em branco.
 */
export function PlaceholderEtapa({
  icone: Icone = Hammer,
  titulo,
  descricao,
  etapa,
  previsto,
  acoes,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">{titulo}</h2>
          <p className="texto-apoio max-w-2xl">{descricao}</p>
        </div>
        {acoes}
      </div>

      <div className="cartao flex flex-col items-center px-6 py-14 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-borda bg-superficie-alternativa">
          <Icone className="size-6 text-texto-tenue" strokeWidth={1.75} />
        </div>

        <span className="mt-5 inline-flex items-center rounded-full bg-destaque-suave px-3 py-1 text-xs font-semibold text-destaque">
          Etapa {etapa}
        </span>

        <h3 className="mt-3 text-base font-semibold text-texto">
          Esta tela será construída na Etapa {etapa}
        </h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-texto-suave">
          A rota já existe e está protegida. O conteúdo entra na etapa correspondente.
        </p>

        {previsto && previsto.length > 0 && (
          <ul className="mt-7 flex max-w-md flex-wrap justify-center gap-2">
            {previsto.map((item) => (
              <li
                key={item}
                className="rounded-full border border-borda bg-superficie-alternativa px-3 py-1.5 text-xs text-texto-suave"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
