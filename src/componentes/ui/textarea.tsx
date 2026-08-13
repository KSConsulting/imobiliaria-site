import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-28 w-full rounded-lg border border-borda-forte bg-superficie px-3.5 py-2.5 text-sm leading-relaxed',
        'placeholder:text-texto-tenue resize-y',
        'transition-[color,box-shadow,border-color]',
        'focus-visible:outline-none focus-visible:border-destaque focus-visible:ring-2 focus-visible:ring-destaque/20',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-superficie-alternativa',
        'aria-invalid:border-destrutivo aria-invalid:ring-2 aria-invalid:ring-destrutivo/15',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
