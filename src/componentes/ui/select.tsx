import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Select nativo estilizado.
 *
 * Nativo de propósito: no mobile ele abre o seletor do próprio sistema,
 * que é mais confortável do que qualquer lista customizada, e a
 * navegação por teclado vem de graça.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-lg border border-borda-forte bg-superficie px-3.5 pr-10 text-sm text-texto',
          'transition-[color,box-shadow,border-color] cursor-pointer',
          'focus-visible:outline-none focus-visible:border-destaque focus-visible:ring-2 focus-visible:ring-destaque/20',
          'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-superficie-alternativa',
          'aria-invalid:border-destrutivo aria-invalid:ring-2 aria-invalid:ring-destrutivo/15',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
    </div>
  )
}

export { Select }
