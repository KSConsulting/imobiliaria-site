import { cn } from '@/lib/utils'

/** Bloco cinza pulsante que ocupa o espaço do conteúdo enquanto carrega. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-borda/70', className)}
      {...props}
    />
  )
}

export { Skeleton }
