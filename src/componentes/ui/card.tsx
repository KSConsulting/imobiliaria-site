import * as React from 'react'
import { cn } from '@/lib/utils'

/** Cartão branco sobre o fundo cinza claro. Superfície padrão do painel. */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-borda bg-superficie shadow-cartao',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-4', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('titulo-secao', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('texto-apoio', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
