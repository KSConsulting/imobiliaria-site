import { Columns3, List } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const VISUALIZACOES = [
  { rotulo: 'Leads', para: '/painel/leads', icone: List },
  { rotulo: 'Funil', para: '/painel/funil', icone: Columns3 },
] as const

/**
 * Alternância entre as duas visualizações de `crm_imobiliaria`.
 *
 * Leads é a lista com busca e filtros; Funil é o Kanban por status.
 * Quem entrou pela tela errada chega na certa em um clique.
 *
 * **Os filtros são preservados** porque a navegação carrega a query
 * string atual (`location.search`) para a outra rota. Isso impõe uma
 * regra às duas telas na Etapa 5: o estado de filtro precisa viver na
 * URL, não em `useState` local. Guardado em estado local, ele se perde
 * na troca e o usuário refaz o filtro toda vez.
 */
export function AlternadorLeadsFunil({ className }: { className?: string }) {
  const navegar = useNavigate()
  const { pathname, search } = useLocation()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-borda bg-superficie-alternativa p-1',
        className,
      )}
      role="tablist"
      aria-label="Visualização dos leads"
    >
      {VISUALIZACOES.map(({ rotulo, para, icone: Icone }) => {
        const ativo = pathname === para
        return (
          <button
            key={para}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => !ativo && navegar({ pathname: para, search })}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              ativo
                ? 'bg-superficie text-texto shadow-cartao'
                : 'text-texto-suave hover:text-texto',
            )}
          >
            <Icone className="size-4" />
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}
