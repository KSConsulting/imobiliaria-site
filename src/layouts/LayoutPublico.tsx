import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { CabecalhoSite } from '@/componentes/publico/CabecalhoSite'
import { RodapeSite } from '@/componentes/publico/RodapeSite'
import { registrarVisualizacao } from '@/lib/rastreamento'

/**
 * Layout da área pública — a vitrine.
 *
 * Direção visual: mais aberto e respirado que o painel, foto como
 * elemento dominante, escala tipográfica maior e mais contraste entre
 * título e corpo. Mesma família tipográfica e mesma cor de destaque do
 * painel, para manter coerência de marca.
 *
 * Fundo branco em vez do cinza do painel: vitrine não é ferramenta de
 * trabalho.
 */
export function LayoutPublico() {
  const { pathname, hash } = useLocation()

  /**
   * Rolagem ao topo a cada navegação.
   *
   * Numa SPA a posição da rolagem é preservada por padrão. Sem isto,
   * quem clica num imóvel no meio da listagem abre a página do imóvel
   * já na metade dela — e no celular esse é o tipo de coisa que faz a
   * pessoa achar que a página carregou errado e voltar.
   *
   * **Com âncora no endereço, quem manda é o efeito seguinte.** Ir ao
   * topo e depois rolar até a seção produziria um salto duplo.
   */
  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  /**
   * Rolagem até a âncora.
   *
   * O navegador faz isso sozinho num link comum, mas **não numa
   * navegação de SPA**: o endereço muda sem recarregar, e o `#secao`
   * fica no endereço sem nada acontecer na tela. É o que faria um chip
   * de categoria no hero filtrar a grade lá embaixo e deixar o visitante
   * parado no topo, sem sinal nenhum de que algo mudou.
   *
   * O deslocamento do cabeçalho fixo vem do `scroll-mt-*` do alvo, e não
   * de um número aqui: a barra muda de altura entre celular e desktop.
   */
  useEffect(() => {
    if (!hash) return
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [pathname, hash])

  /**
   * Visualização de página.
   *
   * A página do imóvel registra a sua própria, com `id_imovel` e
   * `codigo_imovel`, depois de descobrir qual imóvel é — ver
   * `paginas/publico/Imovel.tsx`. Aqui ficam as demais, para que a
   * navegação da vitrine também apareça no dashboard da Etapa 7.
   */
  useEffect(() => {
    if (pathname.startsWith('/imovel/')) return
    registrarVisualizacao(pathname)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-superficie">
      <CabecalhoSite />
      <Outlet />
      <RodapeSite />
    </div>
  )
}
