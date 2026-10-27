import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { GRUPOS_MENU, type ItemMenu } from '@/layouts/menu'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/componentes/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  /** Modo compacto: apenas ícones, com tooltip. */
  compacta?: boolean
  aoAlternarCompacta?: () => void
  /** No mobile a sidebar vive dentro de um Sheet e não tem o botão de recolher. */
  aoNavegar?: () => void
}

export function Sidebar({ compacta = false, aoAlternarCompacta, aoNavegar }: Props) {
  return (
    <div data-sidebar className="flex h-full flex-col bg-sidebar">
      <Marca compacta={compacta} />

      <nav className={cn('flex-1 overflow-y-auto py-4', compacta ? 'px-2' : 'px-3')}>
        {GRUPOS_MENU.map((grupo) => (
          <div key={grupo.rotulo} className="mb-5 last:mb-0">
            {compacta ? (
              <div className="mx-2 mb-2 h-px bg-sidebar-borda" />
            ) : (
              <p className="rotulo-grupo mb-1.5 px-3 text-sidebar-rotulo">{grupo.rotulo}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {grupo.itens.map((item) => (
                <li key={item.para}>
                  <LinkMenu item={item} compacta={compacta} aoNavegar={aoNavegar} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Rodape
        compacta={compacta}
        aoAlternarCompacta={aoAlternarCompacta}
        aoNavegar={aoNavegar}
      />
    </div>
  )
}

/** Logo e nome da imobiliária, puxados das Configurações em tempo real. */
function Marca({ compacta }: { compacta: boolean }) {
  const { configuracoes, carregando } = usarConfiguracoes()
  const logo = configuracoes?.logo_url
  const nome = configuracoes?.nome_negocio

  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-borda',
        compacta ? 'justify-center px-2' : 'px-5',
      )}
    >
      {/* A logo fica sobre um quadrado branco, e não direto no verde.
          Boa parte das logos chega em PNG transparente com o traço
          escuro: solta no fundo escuro, ela simplesmente desaparece, e
          o problema só apareceria na implantação de um cliente. */}
      {logo ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-claro p-1">
          <img src={logo} alt="" className="size-full object-contain" />
        </div>
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-claro text-sm font-bold text-destaque-contraste">
          {(nome ?? 'I').charAt(0).toUpperCase()}
        </div>
      )}

      {!compacta &&
        (carregando ? (
          <Skeleton className="h-4 w-32 bg-claro/15" />
        ) : (
          <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-sidebar-texto-forte">
            {nome ?? 'ImobFlow'}
          </span>
        ))}
    </div>
  )
}

function LinkMenu({
  item,
  compacta,
  aoNavegar,
}: {
  item: ItemMenu
  compacta: boolean
  aoNavegar?: () => void
}) {
  const Icone = item.icone

  const link = (
    <NavLink
      to={item.para}
      end={item.exato}
      onClick={aoNavegar}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          compacta ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          isActive
            ? 'bg-sidebar-ativo text-sidebar-texto-forte'
            : 'text-sidebar-texto hover:bg-sidebar-hover hover:text-sidebar-texto-forte',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Marcador do item ativo */}
          <span
            className={cn(
              'absolute left-0 h-5 w-0.5 rounded-r-full bg-sidebar-marcador transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icone
            className={cn('size-[1.125rem] shrink-0', isActive && 'text-destaque')}
            strokeWidth={isActive ? 2.25 : 1.9}
          />
          {!compacta && <span className="truncate">{item.rotulo}</span>}
        </>
      )}
    </NavLink>
  )

  if (!compacta) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.rotulo}</TooltipContent>
    </Tooltip>
  )
}

function Rodape({ compacta, aoAlternarCompacta, aoNavegar }: Props) {
  const verSite = (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      onClick={aoNavegar}
      className={cn(
        'flex items-center gap-3 rounded-lg text-sm font-medium text-sidebar-texto transition-colors hover:bg-sidebar-hover hover:text-sidebar-texto-forte',
        compacta ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
      )}
    >
      <ExternalLink className="size-[1.125rem] shrink-0" strokeWidth={1.9} />
      {!compacta && <span>Ver site</span>}
    </a>
  )

  return (
    <div
      className={cn('shrink-0 border-t border-sidebar-borda py-3', compacta ? 'px-2' : 'px-3')}
    >
      {compacta ? (
        <Tooltip>
          <TooltipTrigger asChild>{verSite}</TooltipTrigger>
          <TooltipContent side="right">Ver site</TooltipContent>
        </Tooltip>
      ) : (
        verSite
      )}

      {aoAlternarCompacta && (
        <button
          type="button"
          onClick={aoAlternarCompacta}
          aria-label={compacta ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'mt-1 flex w-full cursor-pointer items-center gap-3 rounded-lg text-sm font-medium text-sidebar-rotulo transition-colors hover:bg-sidebar-hover hover:text-sidebar-texto-forte',
            compacta ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          )}
        >
          {compacta ? (
            <PanelLeftOpen className="size-[1.125rem] shrink-0" strokeWidth={1.9} />
          ) : (
            <>
              <PanelLeftClose className="size-[1.125rem] shrink-0" strokeWidth={1.9} />
              <span>Recolher</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
