import { MessageCircle } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { registrarCliqueWhatsapp } from '@/lib/rastreamento'
import { linkWhatsapp, MENSAGEM_GERAL, mensagemDeInteresse } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface Props {
  /** Imóvel de origem do clique. Sem ele, a mensagem é genérica. */
  imovel?: { id: string; codigo: string } | null
  rotulo?: string
  className?: string
  tamanho?: 'padrao' | 'grande'
  variante?: 'destaque' | 'contorno'
}

/**
 * O botão que gera o lead.
 *
 * É o elemento mais importante do site: é dele que sai a primeira
 * mensagem, já com o código do imóvel, que permite ao agente de IA
 * responder sobre aquele imóvel específico na primeira resposta.
 *
 * **O registro do clique nunca segura a navegação.** `registrarCliqueWhatsapp`
 * devolve na hora e a escrita segue sozinha; o `href` é um link de
 * verdade, então o navegador o abre pelo caminho normal — inclusive no
 * celular, onde o toque precisa abrir o aplicativo sem qualquer
 * intermediário de JavaScript no meio. Se a gravação falhar, o clique
 * acontece assim mesmo: perder a medição é aceitável, perder o lead não.
 *
 * Sem número cadastrado nas Configurações, o botão não é renderizado.
 * Um botão que não leva a lugar nenhum é pior do que a ausência dele.
 */
export function BotaoWhatsapp({
  imovel,
  rotulo,
  className,
  tamanho = 'padrao',
  variante = 'destaque',
}: Props) {
  const { configuracoes } = usarConfiguracoes()

  const mensagem = imovel ? mensagemDeInteresse(imovel.codigo) : MENSAGEM_GERAL
  const url = linkWhatsapp(configuracoes?.whatsapp, mensagem)

  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => registrarCliqueWhatsapp(window.location.pathname, imovel)}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors',
        '[&_svg]:shrink-0',
        tamanho === 'grande' ? 'h-13 px-7 text-base' : 'h-11 px-5 text-sm',
        variante === 'destaque'
          ? 'bg-destaque text-destaque-contraste shadow-brilho hover:bg-destaque-hover'
          : 'border border-claro/60 bg-claro/12 text-claro backdrop-blur-sm hover:bg-claro/22',
        className,
      )}
    >
      <MessageCircle className={tamanho === 'grande' ? 'size-5' : 'size-4'} />
      {rotulo ?? (imovel ? 'Falar sobre este imóvel' : 'Falar no WhatsApp')}
    </a>
  )
}
