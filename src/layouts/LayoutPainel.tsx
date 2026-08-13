import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/layouts/Sidebar'
import { HeaderPainel } from '@/layouts/HeaderPainel'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/componentes/ui/sheet'
import { TooltipProvider } from '@/componentes/ui/tooltip'
import { tituloDaRota } from '@/layouts/menu'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { cn } from '@/lib/utils'

const CHAVE_COMPACTA = 'imobflow:sidebar-compacta'

/**
 * Layout da área privada: sidebar fixa à esquerda, header no topo e a
 * área de conteúdo em fundo cinza claro, onde as telas montam seus
 * cartões brancos.
 */
export function LayoutPainel() {
  const { pathname } = useLocation()
  const [compacta, setCompacta] = useState(
    () => localStorage.getItem(CHAVE_COMPACTA) === 'true',
  )
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  const titulo = tituloDaRota(pathname)
  usarTituloPagina(titulo, 'painel')

  useEffect(() => {
    localStorage.setItem(CHAVE_COMPACTA, String(compacta))
  }, [compacta])

  // Fecha o menu sobreposto ao navegar, senão ele fica por cima da
  // página nova no mobile.
  useEffect(() => {
    setMenuMobileAberto(false)
  }, [pathname])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-fundo">
        {/* Sidebar fixa — desktop */}
        {/* Sem borda à direita: a barra é escura e já se separa do
            conteúdo sozinha. Uma borda clara ali só marcaria a emenda. */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
            compacta ? 'w-[4.5rem]' : 'w-64',
          )}
        >
          <Sidebar compacta={compacta} aoAlternarCompacta={() => setCompacta((v) => !v)} />
        </aside>

        {/* Sidebar sobreposta — mobile */}
        <Sheet open={menuMobileAberto} onOpenChange={setMenuMobileAberto}>
          <SheetContent lado="esquerda" className="border-0 p-0">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SheetDescription className="sr-only">
              Navegue entre as seções do painel.
            </SheetDescription>
            <Sidebar aoNavegar={() => setMenuMobileAberto(false)} />
          </SheetContent>
        </Sheet>

        <div
          className={cn(
            'flex min-h-dvh flex-col transition-[padding] duration-200',
            compacta ? 'lg:pl-[4.5rem]' : 'lg:pl-64',
          )}
        >
          <HeaderPainel titulo={titulo} aoAbrirMenu={() => setMenuMobileAberto(true)} />

          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-[90rem]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
