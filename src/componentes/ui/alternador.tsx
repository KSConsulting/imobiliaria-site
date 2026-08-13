import { cn } from '@/lib/utils'

/** Alternador liga/desliga. Usado em "mobiliado" e "aceita pet". */
export function Alternador({
  marcado,
  aoMudar,
  id,
  desabilitado,
  className,
}: {
  marcado: boolean
  aoMudar: (valor: boolean) => void
  id?: string
  desabilitado?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={marcado}
      disabled={desabilitado}
      onClick={() => aoMudar(!marcado)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        marcado ? 'bg-destaque' : 'bg-borda-forte',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block size-4.5 rounded-full bg-superficie shadow-cartao transition-transform',
          marcado ? 'translate-x-[1.4rem]' : 'translate-x-[0.2rem]',
        )}
      />
    </button>
  )
}
