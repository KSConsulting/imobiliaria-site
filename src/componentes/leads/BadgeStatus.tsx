import { etapaDoStatus } from '@/lib/leads'
import { cn } from '@/lib/utils'

/**
 * Etapa do funil como badge colorido.
 *
 * A cor vem de `ETAPAS_FUNIL`, que aponta para as variáveis do
 * `index.css`. É a mesma cor da coluna correspondente no Kanban — ler o
 * badge na tabela e reconhecer a coluna no Funil precisa ser um
 * movimento só.
 */
export function BadgeStatus({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const etapa = etapaDoStatus(status)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        etapa.badge,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', etapa.ponto)} aria-hidden />
      {etapa.rotulo}
    </span>
  )
}
