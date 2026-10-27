import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const variantesBadge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variante: {
        destaque: 'bg-destaque text-destaque-contraste',
        suave: 'bg-destaque-suave text-destaque',
        neutro: 'bg-superficie-alternativa text-texto-suave border border-borda',
        escuro: 'bg-escuro/80 text-claro backdrop-blur-sm',
        alerta: 'bg-alerta/15 text-alerta',
        inativo: 'bg-texto-suave text-superficie',
      },
    },
    defaultVariants: { variante: 'neutro' },
  },
)

export function Badge({
  className,
  variante,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof variantesBadge>) {
  return <span className={cn(variantesBadge({ variante }), className)} {...props} />
}
