import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variantesBotao = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 cursor-pointer",
  {
    variants: {
      variante: {
        primario:
          'bg-destaque text-destaque-contraste shadow-cartao hover:bg-destaque-hover',
        secundario:
          'bg-superficie text-texto border border-borda-forte shadow-cartao hover:bg-superficie-alternativa',
        suave: 'bg-destaque-suave text-destaque hover:brightness-98',
        fantasma: 'text-texto-suave hover:bg-superficie-alternativa hover:text-texto',
        destrutivo: 'bg-destrutivo text-destrutivo-contraste shadow-cartao hover:brightness-110',
        link: 'text-destaque underline-offset-4 hover:underline',
      },
      tamanho: {
        pequeno: 'h-8 px-3 text-[0.8125rem]',
        padrao: 'h-10 px-4',
        grande: 'h-11 px-6',
        icone: 'size-10',
        iconePequeno: 'size-8',
      },
    },
    defaultVariants: {
      variante: 'primario',
      tamanho: 'padrao',
    },
  },
)

export interface PropsBotao
  extends React.ComponentProps<'button'>,
    VariantProps<typeof variantesBotao> {
  asChild?: boolean
}

function Button({ className, variante, tamanho, asChild = false, ...props }: PropsBotao) {
  const Componente = asChild ? Slot : 'button'
  return (
    <Componente className={cn(variantesBotao({ variante, tamanho }), className)} {...props} />
  )
}

export { Button, variantesBotao }
