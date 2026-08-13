import type { ReactNode } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import { ProvedorAutenticacao } from '@/contextos/ContextoAutenticacao'
import { ProvedorConfiguracoes, modoPorRota } from '@/contextos/ContextoConfiguracoes'
import { RotaProtegida } from '@/componentes/RotaProtegida'

import { LayoutPainel } from '@/layouts/LayoutPainel'
import { LayoutPublico } from '@/layouts/LayoutPublico'

import { Login } from '@/paginas/Login'

import { Dashboard } from '@/paginas/painel/Dashboard'
import { Imoveis } from '@/paginas/painel/Imoveis'
import { ImovelFormulario } from '@/paginas/painel/ImovelFormulario'
import { Leads } from '@/paginas/painel/Leads'
import { Funil } from '@/paginas/painel/Funil'
import { Agenda } from '@/paginas/painel/Agenda'
import { Corretores } from '@/paginas/painel/Corretores'
import { Configuracoes } from '@/paginas/painel/Configuracoes'
import { NaoEncontradoPainel } from '@/paginas/painel/NaoEncontrado'

import { Home } from '@/paginas/publico/Home'
import { ImoveisPublico } from '@/paginas/publico/Imoveis'
import { ImovelPublico } from '@/paginas/publico/Imovel'
import { NaoEncontradoPublico } from '@/paginas/publico/NaoEncontrado'

/**
 * Escolhe o modo do contexto de configurações a partir da rota atual.
 *
 * Fica dentro do roteador porque depende de `useLocation`, e o provider
 * é único para as duas áreas — assim navegar entre painel e site não
 * remonta o contexto nem refaz a consulta. Quem decide o modo é
 * `modoPorRota`, e não a posição deste componente na árvore.
 */
function ConfiguracoesPorRota({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ProvedorConfiguracoes modo={modoPorRota(pathname)}>{children}</ProvedorConfiguracoes>
}

/** Casca comum das duas áreas: contextos globais e notificações. */
function Raiz() {
  return (
    <ProvedorAutenticacao>
      <ConfiguracoesPorRota>
        <Outlet />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
        />
      </ConfiguracoesPorRota>
    </ProvedorAutenticacao>
  )
}

/**
 * Roteador de dados (`createBrowserRouter`).
 *
 * A escolha não é estética: `useBlocker` — que segura a navegação
 * quando o formulário de imóvel tem alterações não salvas — só existe
 * em roteador de dados. Com `<BrowserRouter>` o usuário sairia da
 * página perdendo o cadastro sem qualquer aviso.
 */
const roteador = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Raiz />}>
      {/* ---------------- Área pública — a vitrine ---------------- */}
      <Route element={<LayoutPublico />}>
        <Route path="/" element={<Home />} />
        <Route path="/imoveis" element={<ImoveisPublico />} />
        <Route path="/imovel/:codigo" element={<ImovelPublico />} />
        <Route path="*" element={<NaoEncontradoPublico />} />
      </Route>

      {/* ---------------- Login ---------------- */}
      <Route path="/login" element={<Login />} />

      {/* ---------------- Área privada — o painel ---------------- */}
      <Route element={<RotaProtegida />}>
        <Route path="/painel" element={<LayoutPainel />}>
          <Route index element={<Dashboard />} />
          <Route path="imoveis" element={<Imoveis />} />
          <Route path="imoveis/novo" element={<ImovelFormulario />} />
          <Route path="imoveis/:id/editar" element={<ImovelFormulario />} />
          <Route path="leads" element={<Leads />} />
          <Route path="funil" element={<Funil />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="corretores" element={<Corretores />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<NaoEncontradoPainel />} />
        </Route>
      </Route>

      {/* Atalhos */}
      <Route path="/admin" element={<Navigate to="/painel" replace />} />
      <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
    </Route>,
  ),
)

export function App() {
  return <RouterProvider router={roteador} />
}
