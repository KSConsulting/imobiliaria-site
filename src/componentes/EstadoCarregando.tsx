import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/componentes/ui/skeleton'
import { cn } from '@/lib/utils'

/** Spinner centralizado, para blocos pequenos e ações em andamento. */
export function EstadoCarregando({
  mensagem,
  className,
}: {
  mensagem?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-destaque" />
      {mensagem && <p className="text-sm text-texto-suave">{mensagem}</p>}
      <span className="sr-only">Carregando</span>
    </div>
  )
}

/**
 * Esqueleto de tabela.
 *
 * Preferível ao spinner em listas: mantém a altura do bloco e evita que
 * o conteúdo pule para o lugar quando os dados chegam.
 */
export function EsqueletoTabela({ linhas = 6, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="flex flex-col gap-px overflow-hidden rounded-lg" aria-hidden>
      {Array.from({ length: linhas }).map((_, linha) => (
        <div
          key={linha}
          className="grid gap-4 px-1 py-3.5"
          style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: colunas }).map((_, coluna) => (
            <Skeleton
              key={coluna}
              className="h-4"
              style={{ width: coluna === 0 ? '85%' : `${45 + ((linha + coluna) % 3) * 15}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Esqueleto de grade de cartões. */
export function EsqueletoCartoes({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="cartao overflow-hidden">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="flex flex-col gap-2.5 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="mt-1 h-5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
