import { ChevronDown, LogOut, Menu, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { notificar } from '@/lib/notificacoes'

export function HeaderPainel({
  titulo,
  aoAbrirMenu,
}: {
  titulo: string
  aoAbrirMenu: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-borda bg-superficie/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={aoAbrirMenu}
        aria-label="Abrir menu"
        className="-ml-1 flex size-10 cursor-pointer items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-superficie-alternativa hover:text-texto lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <h1 className="flex-1 truncate text-base font-semibold tracking-tight text-texto sm:text-lg">
        {titulo}
      </h1>

      <MenuUsuario />
    </header>
  )
}

function MenuUsuario() {
  const { usuario, usuarioAuth, sair } = usarAutenticacao()
  const navegar = useNavigate()

  const nome = usuario?.nome ?? usuarioAuth?.email?.split('@')[0] ?? 'Usuário'
  const email = usuario?.email ?? usuarioAuth?.email ?? ''
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')

  async function encerrarSessao() {
    try {
      await sair()
      navegar('/login', { replace: true })
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível sair.')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 transition-colors hover:bg-superficie-alternativa data-[state=open]:bg-superficie-alternativa">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destaque-suave text-xs font-semibold text-destaque">
          {iniciais || <UserRound className="size-4" />}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-texto sm:block">
          {nome}
        </span>
        <ChevronDown className="size-4 shrink-0 text-texto-tenue" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-texto">{nome}</span>
          <span className="block truncate text-xs text-texto-suave">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variante="destrutivo" onSelect={() => void encerrarSessao()}>
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
