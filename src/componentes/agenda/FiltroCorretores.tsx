import { Check, Users } from 'lucide-react'
import { Select } from '@/componentes/ui/select'
import { ROTULOS_STATUS_VISITA_PLURAL, STATUS_TODAS } from '@/lib/agendamentos'
import type { CorretorCompleto } from '@/lib/corretores'
import { comOpacidade, corDoTextoSobre } from '@/lib/coresCorretores'
import { cn } from '@/lib/utils'

interface Props {
  corretores: CorretorCompleto[]
  selecionados: string[]
  aoAlternar: (id: string) => void
  aoLimpar: () => void
  status: string
  aoMudarStatus: (status: string) => void
}

/**
 * Filtro por corretor, usando as próprias cores nos controles.
 *
 * O chip colorido é o que ensina a associação cor–pessoa. Uma lista de
 * checkboxes cinza obrigaria o usuário a decorar qual cor é de quem
 * para ler a agenda.
 */
export function FiltroCorretores({
  corretores,
  selecionados,
  aoAlternar,
  aoLimpar,
  status,
  aoMudarStatus,
}: Props) {
  const todos = selecionados.length === 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={aoLimpar}
        aria-pressed={todos}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
          todos
            ? 'border-texto bg-texto text-superficie'
            : 'border-borda-forte bg-superficie text-texto-suave hover:text-texto',
        )}
      >
        <Users className="size-3.5" />
        Todos
      </button>

      {corretores.map((corretor) => {
        const marcado = selecionados.includes(corretor.id)
        return (
          <button
            key={corretor.id}
            type="button"
            onClick={() => aoAlternar(corretor.id)}
            aria-pressed={marcado}
            title={`${corretor.nome} ${corretor.sobrenome}`}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
            )}
            style={
              marcado
                ? {
                    backgroundColor: corretor.cor,
                    borderColor: corretor.cor,
                    color: corDoTextoSobre(corretor.cor),
                  }
                : {
                    backgroundColor: comOpacidade(corretor.cor, 0.1),
                    borderColor: comOpacidade(corretor.cor, 0.35),
                    color: 'var(--texto-suave)',
                  }
            }
          >
            {marcado ? (
              <Check className="size-3.5" />
            ) : (
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: corretor.cor }}
              />
            )}
            {corretor.nome}
          </button>
        )
      })}

      {/* A primeira opção é o padrão da Agenda, e precisa dizer o que
          faz. "Todos os status" no topo de uma grade que esconde as
          canceladas seria a tela contradizendo o próprio rótulo, e o
          usuário concluiria que não existe visita cancelada nenhuma. */}
      <Select
        value={status}
        onChange={(e) => aoMudarStatus(e.target.value)}
        aria-label="Status da visita"
        className="ml-auto h-9 w-52"
      >
        <option value="">Exceto canceladas</option>
        <option value={STATUS_TODAS}>Todas, com canceladas</option>
        {Object.entries(ROTULOS_STATUS_VISITA_PLURAL).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            Só {rotulo.toLowerCase()}
          </option>
        ))}
      </Select>
    </div>
  )
}
