import { useLocation } from 'react-router-dom'
import { Building2, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { MapaEndereco } from '@/componentes/publico/MapaEndereco'
import { montarEndereco } from '@/lib/enderecoNegocio'
import {
  arrobaInstagram,
  formatarTelefone,
  linkWhatsapp,
  MENSAGEM_GERAL,
  urlInstagram,
} from '@/lib/whatsapp'
import { registrarCliqueWhatsapp } from '@/lib/rastreamento'

/**
 * Rodapé da vitrine.
 *
 * **Todo campo é condicional.** Nada aqui é renderizado com valor vazio:
 * sem Instagram cadastrado não existe o ícone do Instagram, sem endereço
 * não existe o bloco de endereço. Rótulo com valor em branco — "Telefone:
 * —" — passa a impressão de cadastro abandonado justamente na hora em que
 * o visitante procura como falar com alguém.
 *
 * A consequência prática: uma imobiliária recém-implantada, que só
 * preencheu nome e WhatsApp, tem um rodapé curto e correto em vez de um
 * rodapé completo e vazio.
 */
export function RodapeSite() {
  const { configuracoes, nomeNegocio } = usarConfiguracoes()

  const endereco = montarEndereco(configuracoes)
  const urlWhatsapp = linkWhatsapp(configuracoes?.whatsapp, MENSAGEM_GERAL)
  const ano = new Date().getFullYear()

  // A home tem a seção "Sobre a imobiliária" logo acima, com o mesmo
  // mapa em tamanho grande. Repeti-lo aqui daria dois mapas do mesmo
  // endereço a uma rolagem de distância, e o de baixo, menor, só faria
  // o de cima parecer um erro de layout.
  //
  // A decisão é pela rota e não por prop, pela mesma razão do
  // `modoPorRota` do contexto de configurações: é comportamento, não
  // estrutura, e precisa sobreviver a quem mover o rodapé de lugar.
  const naHome = useLocation().pathname === '/'

  return (
    <footer id="contato" className="mt-auto border-t border-borda bg-fundo">
      <div className="container-vitrine py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {/* Marca */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {configuracoes?.logo_url ? (
                <img
                  src={configuracoes.logo_url}
                  alt={nomeNegocio}
                  className="size-11 rounded-lg bg-claro object-contain p-1"
                />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-lg bg-destaque">
                  <Building2 className="size-5 text-destaque-contraste" strokeWidth={1.9} />
                </span>
              )}
              <span className="text-lg font-bold tracking-tight text-texto">{nomeNegocio}</span>
            </div>

            <p className="max-w-xs text-sm leading-relaxed text-texto-suave">
              Imóveis para comprar e alugar, com atendimento no WhatsApp e visita agendada com
              corretor.
            </p>

            {/* Só o Instagram. O ícone de globo que levava a
                `configuracoes.site` saiu: quem está lendo este rodapé já
                está no site da imobiliária, e um ícone que promete um
                destino e entrega o lugar onde a pessoa já está gasta o
                clique dela sem devolver nada. */}
            {configuracoes?.instagram && (
              <div className="flex items-center gap-2">
                <a
                  href={urlInstagram(configuracoes.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={arrobaInstagram(configuracoes.instagram)}
                  className="flex size-10 items-center justify-center rounded-lg border border-borda bg-superficie text-texto-suave transition-colors hover:text-destaque"
                >
                  <IconeInstagram className="size-4.5" />
                  <span className="sr-only">Instagram</span>
                </a>
              </div>
            )}
          </div>

          {/* Contato */}
          {(configuracoes?.whatsapp || configuracoes?.telefone || configuracoes?.email) && (
            <div className="flex flex-col gap-3">
              <h3 className="rotulo-grupo">Contato</h3>

              {configuracoes.whatsapp && urlWhatsapp && (
                <a
                  href={urlWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => registrarCliqueWhatsapp(window.location.pathname)}
                  className="flex items-center gap-2.5 text-sm text-texto-suave transition-colors hover:text-destaque"
                >
                  <MessageCircle className="size-4 shrink-0 text-texto-tenue" />
                  {formatarTelefone(configuracoes.whatsapp)}
                </a>
              )}

              {configuracoes.telefone && (
                <a
                  href={`tel:${configuracoes.telefone.replace(/\D/g, '')}`}
                  className="flex items-center gap-2.5 text-sm text-texto-suave transition-colors hover:text-destaque"
                >
                  <Phone className="size-4 shrink-0 text-texto-tenue" />
                  {formatarTelefone(configuracoes.telefone)}
                </a>
              )}

              {configuracoes.email && (
                <a
                  href={`mailto:${configuracoes.email}`}
                  className="flex items-center gap-2.5 break-all text-sm text-texto-suave transition-colors hover:text-destaque"
                >
                  <Mail className="size-4 shrink-0 text-texto-tenue" />
                  {configuracoes.email}
                </a>
              )}
            </div>
          )}

          {/* Endereço */}
          {endereco && (
            <div className="flex flex-col gap-3">
              <h3 className="rotulo-grupo">Onde estamos</h3>

              <p className="flex items-start gap-2.5 text-sm leading-relaxed text-texto-suave">
                <MapPin className="mt-0.5 size-4 shrink-0 text-texto-tenue" />
                <span>{endereco}</span>
              </p>

              {!naHome && (
                <MapaEndereco configuracoes={configuracoes} nome={nomeNegocio} className="h-48" />
              )}
            </div>
          )}
        </div>

        <div className="mt-12 border-t border-borda pt-6">
          <p className="text-xs text-texto-tenue">
            © {ano} {nomeNegocio}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}

/**
 * O glifo do Instagram.
 *
 * Desenhado aqui porque o lucide 1.x tirou os ícones de marca da
 * biblioteca, e o `AtSign` que ocupava este lugar dizia "arroba", não
 * "Instagram": num rodapé com um ícone só, ninguém lê o `title` para
 * descobrir para onde ele leva.
 */
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.64.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92C8.42 2.17 8.8 2.16 12 2.16Zm0-2.16C8.74 0 8.33.01 7.05.07 2.7.27.28 2.69.08 7.05.02 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
    </svg>
  )
}
