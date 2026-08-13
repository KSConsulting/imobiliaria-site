import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check } from 'lucide-react'
import type { ItemProntidao } from '@/lib/configuracoes'

/**
 * O que ainda falta para o site poder ser divulgado.
 *
 * Some quando tudo está pronto, e some de propósito. Um bloco verde
 * permanente dizendo "está tudo certo" ocuparia o topo da tela para
 * sempre repetindo uma informação que só interessa uma vez — e, pior,
 * treinaria o olho a ignorar aquela região justamente onde o aviso
 * apareceria de novo se alguém apagasse a logo.
 */
export function BlocoProntidao({
  itens,
  aoIrParaCampo,
}: {
  itens: ItemProntidao[]
  /** Rola até o campo, quando o item se resolve nesta mesma aba. */
  aoIrParaCampo: (chave: ItemProntidao['chave']) => void
}) {
  const pendentes = itens.filter((item) => !item.pronto)
  if (pendentes.length === 0) return null

  return (
    <section className="rounded-xl border border-alerta/35 bg-alerta/6 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-alerta/12">
          <AlertTriangle className="size-4.5 text-alerta" strokeWidth={2} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="titulo-secao">
            {pendentes.length === 1
              ? 'Falta 1 item para publicar o site'
              : `Faltam ${pendentes.length} itens para publicar o site`}
          </h3>
          <p className="texto-apoio">
            O site já está no ar e abre normalmente — é essa a parte perigosa. Sem os itens abaixo
            ele abre <em>e não funciona</em>, e ninguém percebe até um cliente reclamar.
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {pendentes.map((item) => (
              <li
                key={item.chave}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-borda bg-superficie px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-texto">{item.rotulo}</span>
                  <span className="text-xs leading-relaxed text-texto-suave">
                    {item.consequencia}
                  </span>
                </div>

                {item.chave === 'imoveis' ? (
                  <Link
                    to={item.destino}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-destaque hover:underline"
                  >
                    {item.rotuloDestino}
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => aoIrParaCampo(item.chave)}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm font-medium text-destaque hover:underline"
                  >
                    {item.rotuloDestino}
                    <ArrowRight className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {itens.length - pendentes.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-texto-tenue">
              <Check className="size-3.5 text-sucesso" strokeWidth={2.5} />
              {itens.length - pendentes.length} de {itens.length} já resolvidos.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
