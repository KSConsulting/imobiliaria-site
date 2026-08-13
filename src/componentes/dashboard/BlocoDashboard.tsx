import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  titulo: string
  /** Explica o recorte. Vale a pena quando o bloco não é do período. */
  descricao?: string
  icone?: LucideIcon
  acao?: ReactNode
  carregando: boolean
  erro: boolean
  aoRecarregar: () => void
  /** `true` quando a consulta respondeu, mas sem nada no período. */
  vazio?: boolean
  /** Mensagem específica do bloco. Nunca genérica — ver comentário. */
  mensagemVazio?: string
  /** Altura do esqueleto, para o bloco não pular quando os dados chegam. */
  alturaEsqueleto?: number
  className?: string
  children: ReactNode
}

/**
 * Cartão padrão de um bloco do Dashboard.
 *
 * Concentra os três estados que todo bloco tem — carregando, com erro e
 * vazio — para que nenhum deles seja esquecido em um cartão e tratado em
 * outro.
 *
 * **O estado vazio é por bloco e com mensagem própria.** Um gráfico
 * zerado é ambíguo: o usuário não sabe se não houve clique nenhum ou se
 * a consulta falhou. "Nenhum clique no WhatsApp nesse período" responde
 * a pergunta e, de quebra, sugere que o problema pode ser o período
 * escolhido.
 */
export function BlocoDashboard({
  titulo,
  descricao,
  icone: Icone,
  acao,
  carregando,
  erro,
  aoRecarregar,
  vazio,
  mensagemVazio = 'Nada registrado nesse período.',
  alturaEsqueleto = 180,
  className,
  children,
}: Props) {
  return (
    <section className={cn('cartao flex flex-col p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icone && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destaque-suave">
              <Icone className="size-4 text-destaque" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="titulo-secao truncate">{titulo}</h3>
            {descricao && <p className="mt-0.5 text-xs text-texto-tenue">{descricao}</p>}
          </div>
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>

      {carregando ? (
        <div className="flex flex-col gap-2.5" style={{ minHeight: alturaEsqueleto }} aria-hidden>
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="mt-1 h-24 w-full" />
        </div>
      ) : erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <AlertTriangle className="size-6 text-alerta" strokeWidth={1.7} />
          <p className="max-w-xs text-sm text-texto-suave">
            Não foi possível carregar este bloco. Os demais continuam válidos.
          </p>
          <Button variante="secundario" tamanho="pequeno" onClick={aoRecarregar}>
            <RotateCw className="size-3.5" />
            Tentar de novo
          </Button>
        </div>
      ) : vazio ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="max-w-xs text-center text-sm leading-relaxed text-texto-tenue">
            {mensagemVazio}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
