import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

/** Painel lateral sobreposto. Usado pela sidebar no mobile. */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

function SheetContent({
  className,
  children,
  lado = 'esquerda',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  lado?: 'esquerda' | 'direita'
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-texto/35 backdrop-blur-[2px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-[17rem] flex-col bg-superficie shadow-sobreposto',
          'transition ease-in-out data-[state=open]:duration-300 data-[state=closed]:duration-200',
          lado === 'esquerda'
            ? 'left-0 border-r border-borda data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left'
            : 'right-0 border-l border-borda data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }
