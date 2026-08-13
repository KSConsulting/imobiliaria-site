import { Link } from 'react-router-dom'
import { Home, Search } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { Button } from '@/componentes/ui/button'

/**
 * 404 da vitrine.
 *
 * Esta página aparece com frequência, e não por engano de digitação: a
 * exclusão de imóvel é definitiva (ver CLAUDE.md), enquanto links
 * antigos de WhatsApp continuam circulando por meses. Quem chega aqui
 * quase sempre clicou num imóvel que existia de verdade.
 *
 * Por isso o texto não trata o visitante como se ele tivesse errado o
 * endereço: explica o que provavelmente aconteceu com o imóvel e
 * oferece a busca como próximo passo, em vez de encerrar a visita.
 */
export function NaoEncontradoPublico() {
  const { configuracoes } = usarConfiguracoes()
  usarTituloPagina('Imóvel não encontrado', 'publico')

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-semibold tracking-widest text-destaque">ERRO 404</p>

        <h1 className="titulo-vitrine mt-4">Este imóvel não está mais disponível</h1>

        <p className="subtitulo-vitrine mx-auto mt-5 max-w-lg">
          O imóvel que você procura pode ter sido vendido, alugado ou retirado da nossa
          carteira. Acontece — e links de WhatsApp costumam circular por bastante tempo
          depois disso.
        </p>

        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-texto-suave">
          Temos outros imóveis parecidos. Vale dar uma olhada na busca.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild tamanho="grande">
            <Link to="/imoveis">
              <Search className="size-4" />
              Ver imóveis disponíveis
            </Link>
          </Button>
          <Button asChild variante="secundario" tamanho="grande">
            <Link to="/">
              <Home className="size-4" />
              Ir para a página inicial
            </Link>
          </Button>
        </div>

        {configuracoes?.whatsapp && (
          <p className="mt-8 text-sm text-texto-tenue">
            Prefere falar com a gente? Chame no WhatsApp {configuracoes.whatsapp}.
          </p>
        )}
      </div>
    </main>
  )
}
