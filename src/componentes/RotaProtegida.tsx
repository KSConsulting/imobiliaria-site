import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao'

/**
 * Guarda das rotas sob `/painel`.
 *
 * O `carregando` não é detalhe: sem ele, o usuário autenticado que
 * recarrega a página é jogado para o login por um instante, porque a
 * sessão do Supabase é lida do armazenamento local de forma assíncrona
 * e no primeiro render ainda não chegou. Esse é o erro mais comum
 * nessa implementação.
 */
export function RotaProtegida() {
  const { autenticado, carregando } = usarAutenticacao()
  const localizacao = useLocation()

  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-fundo">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-destaque" />
          <p className="text-sm text-texto-suave">Verificando acesso…</p>
        </div>
      </div>
    )
  }

  if (!autenticado) {
    // Guarda o destino para voltar até ele depois do login.
    return <Navigate to="/login" replace state={{ de: localizacao.pathname + localizacao.search }} />
  }

  return <Outlet />
}
