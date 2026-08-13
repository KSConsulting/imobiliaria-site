import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Building2, Menu, X } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { cn } from '@/lib/utils'

const NAVEGACAO = [
  { rotulo: 'Início', para: '/' },
  { rotulo: 'Imóveis', para: '/imoveis' },
  { rotulo: 'Contato', para: '/#contato' },
]

/**
 * Cabeçalho da vitrine.
 *
 * Logo e nome vêm das Configurações, então trocar a marca é trocar um
 * campo no painel — nunca um deploy.
 *
 * **A logo cresce no desktop e o nome encolhe**, e é uma decisão de
 * marca, não de layout. Boa parte das imobiliárias tem a logo desenhada
 * com o nome dentro; a 40px, ao lado de um nome em 18px, ela vira um
 * selo ilegível e quem carrega a identidade passa a ser o texto ao lado,
 * que é o oposto do que uma vitrine deveria fazer.
 *
 * **Não há botão de WhatsApp aqui.** O contato acontece onde existe algo
 * para conversar: no botão de cada imóvel, que já leva o código na
 * mensagem, e no rodapé. Um botão de conversa no topo da home abre um
 * atendimento sem assunto, e o agente começa perguntando o que a pessoa
 * procura — que é a pergunta que o site inteiro existe para responder
 * antes do WhatsApp.
 */
export function CabecalhoSite() {
  const { configuracoes, nomeNegocio } = usarConfiguracoes()
  const { pathname, hash } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)

  // Fecha o menu ao navegar. Sem isso, tocar num item no celular leva à
  // página nova com o menu ainda cobrindo a tela.
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname, hash])

  return (
    <header className="sticky top-0 z-40 border-b border-borda/70 bg-superficie/85 backdrop-blur-md">
      {/* A barra fica mais alta no desktop para caber a logo maior sem
          espremê-la contra a borda. No celular a altura antiga vale, que
          é onde cada pixel de altura tira conteúdo da primeira dobra. */}
      <div className="container-vitrine flex h-18 items-center gap-4 md:h-20">
        {/* Marca */}
        <Link to="/" className="flex min-w-0 items-center gap-3">
          {configuracoes?.logo_url ? (
            <img
              src={configuracoes.logo_url}
              alt={nomeNegocio}
              className="size-10 shrink-0 rounded-lg object-contain md:size-14"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destaque md:size-14">
              <Building2 className="size-5 text-destaque-contraste md:size-7" strokeWidth={1.9} />
            </span>
          )}
          <span className="truncate text-lg font-bold tracking-tight text-texto md:text-base">
            {nomeNegocio}
          </span>
        </Link>

        {/* Navegação — desktop */}
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAVEGACAO.map(({ rotulo, para }) => (
            <ItemNavegacao key={para} para={para} rotulo={rotulo} />
          ))}
        </nav>

        {/* Alternador do menu — mobile */}
        <button
          type="button"
          onClick={() => setMenuAberto((aberto) => !aberto)}
          aria-expanded={menuAberto}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          className="ml-auto flex size-11 cursor-pointer items-center justify-center rounded-lg text-texto transition-colors hover:bg-superficie-alternativa md:hidden"
        >
          {menuAberto ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Navegação — mobile */}
      {menuAberto && (
        <div className="border-t border-borda bg-superficie md:hidden">
          <nav className="container-vitrine flex flex-col gap-1 py-4">
            {NAVEGACAO.map(({ rotulo, para }) => (
              <ItemNavegacao key={para} para={para} rotulo={rotulo} mobile />
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

function ItemNavegacao({
  para,
  rotulo,
  mobile,
}: {
  para: string
  rotulo: string
  mobile?: boolean
}) {
  const classes = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-lg font-medium transition-colors',
      mobile ? 'px-3 py-3 text-base' : 'px-3.5 py-2 text-sm',
      isActive && !para.includes('#')
        ? 'text-destaque'
        : 'text-texto-suave hover:bg-superficie-alternativa hover:text-texto',
    )

  // Âncoras (`/#contato`) não são rota: precisam de link comum, senão o
  // roteador tenta navegar e o hash não leva a lugar nenhum.
  if (para.includes('#')) {
    return (
      <a
        href={para}
        className={cn(
          'rounded-lg font-medium text-texto-suave transition-colors hover:bg-superficie-alternativa hover:text-texto',
          mobile ? 'px-3 py-3 text-base' : 'px-3.5 py-2 text-sm',
        )}
      >
        {rotulo}
      </a>
    )
  }

  return (
    <NavLink to={para} end={para === '/'} className={classes}>
      {rotulo}
    </NavLink>
  )
}
