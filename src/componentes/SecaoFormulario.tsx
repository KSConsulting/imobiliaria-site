import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/componentes/ui/label'
import { cn } from '@/lib/utils'

/** Bloco visual de uma seção do formulário. */
export function SecaoFormulario({
  id,
  icone: Icone,
  titulo,
  descricao,
  comErro,
  acao,
  children,
}: {
  id: string
  icone: LucideIcon
  titulo: string
  descricao?: string
  comErro?: boolean
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 rounded-xl border bg-superficie shadow-cartao transition-colors',
        comErro ? 'border-destrutivo/45' : 'border-borda',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
              comErro ? 'bg-destrutivo/10' : 'bg-destaque-suave',
            )}
          >
            {comErro ? (
              <AlertCircle className="size-4.5 text-destrutivo" />
            ) : (
              <Icone className="size-4.5 text-destaque" strokeWidth={1.9} />
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="titulo-secao">{titulo}</h3>
            {descricao && <p className="texto-apoio">{descricao}</p>}
          </div>
        </div>
        {acao}
      </header>

      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

/** Campo com rótulo, marcador de obrigatório, dica e mensagem de erro. */
export function Campo({
  id,
  rotulo,
  obrigatorio,
  dica,
  erro,
  className,
  children,
}: {
  id: string
  rotulo: string
  obrigatorio?: boolean
  dica?: string
  erro?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span className="ml-1 text-destrutivo" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {erro ? (
        <p className="flex items-center gap-1.5 text-xs text-destrutivo" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {erro}
        </p>
      ) : (
        dica && <p className="text-xs text-texto-tenue">{dica}</p>
      )}
    </div>
  )
}
