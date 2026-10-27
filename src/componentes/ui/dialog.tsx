import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogContent({
  className,
  children,
  semBotaoFechar,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { semBotaoFechar?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-escuro/70 backdrop-blur-sm',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-xl border border-borda bg-superficie shadow-sobreposto',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {!semBotaoFechar && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 flex size-8 cursor-pointer items-center justify-center rounded-lg text-texto-tenue transition-colors hover:bg-superficie-alternativa hover:text-texto"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 flex-col gap-1.5 border-b border-borda p-5 pr-14', className)}
      {...props}
    />
  )
}

/** Corpo rolável: o cabeçalho e o rodapé ficam fixos. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto p-5', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2 border-t border-borda p-5 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('titulo-secao', className)} {...props} />
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('texto-apoio', className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
