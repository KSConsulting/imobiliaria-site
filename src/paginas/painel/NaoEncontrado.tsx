import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/componentes/ui/button'

/**
 * 404 da área do painel.
 *
 * Renderizada dentro do LayoutPainel, então mantém sidebar e header —
 * quem se perdeu continua com a navegação à mão.
 */
export function NaoEncontradoPainel() {
  return (
    <div className="cartao flex flex-col items-center px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-borda bg-superficie-alternativa">
        <Compass className="size-6 text-texto-tenue" strokeWidth={1.75} />
      </div>
      <p className="mt-5 text-xs font-semibold tracking-widest text-texto-tenue">ERRO 404</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-texto">
        Página não encontrada
      </h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-texto-suave">
        Este endereço não existe no painel.
      </p>
      <Button asChild className="mt-7">
        <Link to="/painel">Voltar ao Dashboard</Link>
      </Button>
    </div>
  )
}
