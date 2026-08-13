import {
  Copy,
  EyeOff,
  ExternalLink,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { notificar } from '@/lib/notificacoes'
import type { ImovelComRelacoes } from '@/lib/imoveis'
import { cn } from '@/lib/utils'

/** URL pública da página do imóvel, a mesma que o site usa. */
export function urlPublicaDoImovel(codigo: string): string {
  return `${window.location.origin}/imovel/${codigo}`
}

interface Props {
  imovel: ImovelComRelacoes
  aoAlternarStatus: (imovel: ImovelComRelacoes) => void
  aoExcluir: (imovel: ImovelComRelacoes) => void
  className?: string
}

export function AcoesImovel({ imovel, aoAlternarStatus, aoExcluir, className }: Props) {
  const navegar = useNavigate()
  const ativo = imovel.status === 'ativo'

  async function copiarLink() {
    const url = urlPublicaDoImovel(imovel.codigo)
    try {
      await navigator.clipboard.writeText(url)
      notificar.sucesso('Link copiado', url)
    } catch {
      notificar.erro('Não foi possível copiar o link', url)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Ações do imóvel ${imovel.codigo}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex size-9 cursor-pointer items-center justify-center rounded-lg border border-borda bg-superficie/90 text-texto-suave shadow-cartao backdrop-blur-sm transition-colors',
          'hover:bg-superficie hover:text-texto data-[state=open]:bg-superficie data-[state=open]:text-texto',
          className,
        )}
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => navegar(`/painel/imoveis/${imovel.id}/editar`)}>
          <Pencil className="size-4" />
          Editar
        </DropdownMenuItem>

        {/* Imóvel inativo não existe na vitrine — abrir o link levaria a
            uma 404. Melhor desabilitar e dizer o porquê. */}
        {ativo ? (
          <DropdownMenuItem
            onSelect={() =>
              window.open(urlPublicaDoImovel(imovel.codigo), '_blank', 'noopener')
            }
          >
            <ExternalLink className="size-4" />
            Ver no site
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="flex-col !items-start gap-0.5">
            <span className="flex items-center gap-2.5">
              <EyeOff className="size-4" />
              Ver no site
            </span>
            <span className="pl-6.5 text-xs text-texto-tenue">
              Indisponível: o imóvel está inativo e não aparece na vitrine
            </span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={() => void copiarLink()}>
          <Copy className="size-4" />
          Copiar link
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => aoAlternarStatus(imovel)}>
          <Power className="size-4" />
          {ativo ? 'Desativar' : 'Reativar'}
        </DropdownMenuItem>

        <DropdownMenuItem variante="destrutivo" onSelect={() => aoExcluir(imovel)}>
          <Trash2 className="size-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
