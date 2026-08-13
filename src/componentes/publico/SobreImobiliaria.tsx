import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { MapaEndereco } from '@/componentes/publico/MapaEndereco'
import { SOBRE } from '@/componentes/publico/textos'
import { consultaDoMapa, montarEndereco } from '@/lib/enderecoNegocio'
import { formatarTelefone, linkWhatsapp, MENSAGEM_GERAL } from '@/lib/whatsapp'
import { registrarCliqueWhatsapp } from '@/lib/rastreamento'
import {
  agruparHorario,
  lerHorario,
  rotularDias,
  rotularFaixa,
} from '@/lib/horarioFuncionamento'

/**
 * "Sobre a imobiliária", no fim da home.
 *
 * Fecha a página respondendo a pergunta que sobra depois de o visitante
 * gostar de um imóvel: **com quem ele está falando, e onde essa gente
 * fica.** Endereço com mapa é a prova mais barata de que existe uma
 * imobiliária de verdade do outro lado, e ela pesa mais no anúncio de um
 * bem caro do que qualquer texto institucional.
 *
 * Duas colunas: o texto à esquerda, o mapa à direita. No celular elas
 * empilham, com o mapa por último — quem está no celular já está a um
 * toque do WhatsApp, e o mapa é consulta, não ação.
 *
 * **A seção inteira some quando não há endereço nem contato**, como todo
 * o resto da vitrine. Um bloco "Sobre" com o nome e mais nada seria pior
 * do que não existir.
 */
export function SobreImobiliaria() {
  const { configuracoes, nomeNegocio } = usarConfiguracoes()

  const endereco = montarEndereco(configuracoes)
  const temMapa = Boolean(consultaDoMapa(configuracoes))
  const urlWhatsapp = linkWhatsapp(configuracoes?.whatsapp, MENSAGEM_GERAL)

  // Em linhas, não na frase corrida que o agente recebe. Aqui existe
  // tabela e o olho varre a coluna dos dias procurando o de hoje; no
  // WhatsApp não existe layout, e lá a frase é a única forma possível.
  const { abertos, fechados } = agruparHorario(lerHorario(configuracoes?.horario_funcionamento))

  const temContato = Boolean(
    configuracoes?.whatsapp || configuracoes?.telefone || configuracoes?.email,
  )
  if (!endereco && !temContato) return null

  return (
    <section id="sobre" className="border-t border-borda bg-superficie-alternativa">
      <div className="container-vitrine secao-vitrine">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Texto */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h2 className="titulo-secao-vitrine">{SOBRE.titulo}</h2>
              <p className="subtitulo-vitrine max-w-xl">{SOBRE.texto}</p>
            </div>

            <dl className="flex flex-col gap-4">
              {endereco && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-destaque" />
                  <div className="flex flex-col gap-0.5">
                    <dt className="rotulo-grupo">Endereço</dt>
                    <dd className="text-base leading-relaxed text-texto">{endereco}</dd>
                  </div>
                </div>
              )}

              {/* Logo depois do endereço: "onde vocês ficam" e "quando
                  vocês abrem" é a mesma decisão para quem está pensando
                  em ir até lá. Some inteiro quando nada foi informado,
                  como todo o resto da vitrine. */}
              {abertos.length > 0 && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-destaque" />
                  <div className="flex flex-col gap-1">
                    <dt className="rotulo-grupo">Atendimento</dt>
                    <dd className="flex flex-col gap-0.5">
                      {abertos.map((grupo) => (
                        <span
                          key={grupo.dias.join('-')}
                          className="text-base leading-relaxed text-texto"
                        >
                          <span className="capitalize">{rotularDias(grupo.dias)}</span>{' '}
                          {rotularFaixa(grupo)}
                        </span>
                      ))}

                      {fechados.length > 0 && (
                        <span className="text-base leading-relaxed text-texto-tenue">
                          <span className="capitalize">{rotularDias(fechados)}</span>{' '}
                          {fechados.length === 1 ? 'fechado' : 'fechados'}
                        </span>
                      )}
                    </dd>
                  </div>
                </div>
              )}

              {configuracoes?.whatsapp && urlWhatsapp && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 size-5 shrink-0 text-destaque" />
                  <div className="flex flex-col gap-0.5">
                    <dt className="rotulo-grupo">WhatsApp</dt>
                    <dd>
                      <a
                        href={urlWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => registrarCliqueWhatsapp(window.location.pathname)}
                        className="text-base text-texto transition-colors hover:text-destaque"
                      >
                        {formatarTelefone(configuracoes.whatsapp)}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {configuracoes?.telefone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-5 shrink-0 text-destaque" />
                  <div className="flex flex-col gap-0.5">
                    <dt className="rotulo-grupo">Telefone</dt>
                    <dd>
                      <a
                        href={`tel:${configuracoes.telefone.replace(/\D/g, '')}`}
                        className="text-base text-texto transition-colors hover:text-destaque"
                      >
                        {formatarTelefone(configuracoes.telefone)}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {configuracoes?.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-5 shrink-0 text-destaque" />
                  <div className="flex flex-col gap-0.5">
                    <dt className="rotulo-grupo">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${configuracoes.email}`}
                        className="text-base break-all text-texto transition-colors hover:text-destaque"
                      >
                        {configuracoes.email}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Mapa. Sem endereço completo ele não existe, e aí o texto
              ocupa a largura toda em vez de deixar meia tela vazia. */}
          {temMapa && (
            <MapaEndereco
              configuracoes={configuracoes}
              nome={nomeNegocio}
              className="h-80 lg:h-[26rem]"
            />
          )}
        </div>
      </div>
    </section>
  )
}
