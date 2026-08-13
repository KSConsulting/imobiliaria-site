import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Controle de incremento para quantidades pequenas — quartos, suítes,
 * banheiros e vagas.
 *
 * O campo continua digitável: quem cadastra um prédio com 40 vagas não
 * deve precisar de 40 cliques.
 */
export function Contador({
  valor,
  aoMudar,
  id,
  minimo = 0,
  maximo = 99,
  className,
}: {
  valor: number
  aoMudar: (valor: number) => void
  id?: string
  minimo?: number
  maximo?: number
  className?: string
}) {
  function limitar(proximo: number) {
    aoMudar(Math.max(minimo, Math.min(maximo, proximo)))
  }

  return (
    <div
      className={cn(
        'inline-flex h-11 items-center rounded-lg border border-borda-forte bg-superficie',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Diminuir"
        disabled={valor <= minimo}
        onClick={() => limitar(valor - 1)}
        className="flex size-10 cursor-pointer items-center justify-center rounded-l-lg text-texto-suave transition-colors hover:bg-superficie-alternativa hover:text-texto disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Minus className="size-4" />
      </button>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={valor}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '')
          limitar(digitos ? Number(digitos) : minimo)
        }}
        className="w-11 border-x border-borda bg-transparent text-center text-sm font-medium text-texto outline-none focus-visible:bg-superficie-alternativa"
      />

      <button
        type="button"
        aria-label="Aumentar"
        disabled={valor >= maximo}
        onClick={() => limitar(valor + 1)}
        className="flex size-10 cursor-pointer items-center justify-center rounded-r-lg text-texto-suave transition-colors hover:bg-superficie-alternativa hover:text-texto disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
