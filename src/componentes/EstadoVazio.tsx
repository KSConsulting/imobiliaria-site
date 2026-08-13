import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  icone?: LucideIcon
  titulo: string
  /** Explica o que fazer, não apenas que está vazio. */
  descricao?: string
  acao?: {
    rotulo: string
    aoClicar: () => void
  }
  className?: string
}

/**
 * Estado vazio padrão de listas sem registros.
 *
 * Lista vazia sem explicação é indistinguível de erro de carregamento —
 * o usuário não sabe se não há nada ou se algo quebrou. Por isso o
 * componente sempre traz uma ação sugerida quando existe uma.
 */
export function EstadoVazio({
  icone: Icone = Inbox,
  titulo,
  descricao,
  acao,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-superficie-alternativa border border-borda">
        <Icone className="size-6 text-texto-tenue" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-texto">{titulo}</h3>
      {descricao && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-texto-suave">{descricao}</p>
      )}
      {acao && (
        <Button className="mt-6" onClick={acao.aoClicar}>
          {acao.rotulo}
        </Button>
      )}
    </div>
  )
}
