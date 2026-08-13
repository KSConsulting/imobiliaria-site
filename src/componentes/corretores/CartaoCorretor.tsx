import {
  BadgeCheck,
  CalendarDays,
  CalendarClock,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Power,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/componentes/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { resumirJanela, type CorretorCompleto } from '@/lib/corretores'
import { corDoTextoSobre } from '@/lib/coresCorretores'
import { cn } from '@/lib/utils'

interface Props {
  corretor: CorretorCompleto
  aoEditar: (corretor: CorretorCompleto) => void
  aoAlternarStatus: (corretor: CorretorCompleto) => void
  aoExcluir: (corretor: CorretorCompleto) => void
}

export function CartaoCorretor({ corretor, aoEditar, aoAlternarStatus, aoExcluir }: Props) {
  const navegar = useNavigate()
  const inativo = !corretor.ativo
  const nomeCompleto = `${corretor.nome} ${corretor.sobrenome}`
  const iniciais = `${corretor.nome.charAt(0)}${corretor.sobrenome.charAt(0)}`.toUpperCase()
  const janela = resumirJanela(corretor.agendas?.agendas_horarios ?? [])

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-cartao transition-shadow hover:shadow-elevado',
        inativo && 'opacity-70',
      )}
    >
      {/* A faixa é a mesma cor que identifica as visitas dele na agenda.
          A associação precisa ser aprendida aqui para funcionar lá. */}
      <div className="h-1.5 w-full" style={{ backgroundColor: corretor.cor }} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: corretor.cor, color: corDoTextoSobre(corretor.cor) }}
            >
              {iniciais}
            </span>

            <div className="min-w-0">
              <h3 className="truncate text-[0.9375rem] font-semibold text-texto">
                {nomeCompleto}
              </h3>
              {corretor.creci ? (
                <p className="flex items-center gap-1.5 text-xs text-texto-suave">
                  <BadgeCheck className="size-3.5 shrink-0" />
                  CRECI {corretor.creci}
                </p>
              ) : (
                <p className="text-xs text-texto-tenue">Sem CRECI cadastrado</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações de ${nomeCompleto}`}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-superficie-alternativa hover:text-texto data-[state=open]:bg-superficie-alternativa"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => aoEditar(corretor)}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => navegar(`/painel/agenda?corretores=${corretor.id}`)}
              >
                <CalendarDays className="size-4" />
                Ver agenda
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={() => aoAlternarStatus(corretor)}>
                <Power className="size-4" />
                {corretor.ativo ? 'Desativar' : 'Reativar'}
              </DropdownMenuItem>

              <DropdownMenuItem variante="destrutivo" onSelect={() => aoExcluir(corretor)}>
                <Trash2 className="size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {inativo && (
          <Badge variante="inativo" className="w-fit">
            Inativo · não recebe novas visitas
          </Badge>
        )}

        <ul className="flex flex-col gap-2 text-sm">
          {corretor.whatsapp && (
            <li className="flex items-center gap-2 text-texto-suave">
              <Phone className="size-3.5 shrink-0 text-texto-tenue" />
              <span className="truncate">{corretor.whatsapp}</span>
            </li>
          )}
          {corretor.email && (
            <li className="flex items-center gap-2 text-texto-suave">
              <Mail className="size-3.5 shrink-0 text-texto-tenue" />
              <span className="truncate">{corretor.email}</span>
            </li>
          )}
          <li className="flex items-start gap-2 text-texto-suave">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-texto-tenue" />
            <span className="leading-snug">{janela}</span>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => navegar(`/painel/agenda?corretores=${corretor.id}`)}
          className="mt-auto flex cursor-pointer items-center justify-between rounded-lg border border-borda bg-superficie-alternativa px-3.5 py-2.5 text-left transition-colors hover:border-destaque"
        >
          <span className="text-sm text-texto-suave">Visitas agendadas</span>
          <span
            className={cn(
              'text-sm font-semibold',
              corretor.visitasProximas > 0 ? 'text-texto' : 'text-texto-tenue',
            )}
          >
            {corretor.visitasProximas > 0 ? corretor.visitasProximas : 'nenhuma'}
          </span>
        </button>
      </div>
    </article>
  )
}
