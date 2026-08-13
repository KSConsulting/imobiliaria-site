import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bath,
  BedDouble,
  Car,
  Check,
  DoorOpen,
  MapPin,
  PawPrint,
  Ruler,
  Sofa,
} from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { usarMetadados } from '@/ganchos/usarMetadados'
import { GaleriaImovel } from '@/componentes/publico/GaleriaImovel'
import { BotaoWhatsapp } from '@/componentes/publico/BotaoWhatsapp'
import { CartaoImovelPublico } from '@/componentes/publico/CartaoImovelPublico'
import { NaoEncontradoPublico } from '@/paginas/publico/NaoEncontrado'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import {
  badgesDeFinalidade,
  buscarImovelPorCodigo,
  capaDoImovel,
  diferenciaisDoImovel,
  fotosOrdenadas,
  listarSemelhantes,
  ROTULOS_FINALIDADE_VITRINE,
  type ImovelDetalhe,
  type ImovelVitrine,
} from '@/lib/publico'
import { formatarArea, formatarMoeda, formatarMoedaCurta } from '@/lib/formato'
import { registrarVisualizacao } from '@/lib/rastreamento'
import { urlExterna } from '@/lib/whatsapp'

export function ImovelPublico() {
  const { codigo } = useParams<{ codigo: string }>()
  const { configuracoes, nomeNegocio } = usarConfiguracoes()

  const [imovel, setImovel] = useState<ImovelDetalhe | null>(null)
  const [semelhantes, setSemelhantes] = useState<ImovelVitrine[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!codigo) return

    let ativo = true
    setCarregando(true)

    void (async () => {
      try {
        const encontrado = await buscarImovelPorCodigo(codigo)
        if (!ativo) return

        setImovel(encontrado)

        if (encontrado) {
          // A visualização é registrada aqui, e não no layout, porque só
          // agora se sabe qual imóvel é — e é o `id_imovel` que alimenta
          // o contador e o ranking de mais vistos.
          registrarVisualizacao(`/imovel/${encontrado.codigo}`, encontrado)
          setSemelhantes(await listarSemelhantes(encontrado))
        }
      } catch (erro) {
        console.warn('[vitrine] falha ao carregar o imóvel:', erro)
        if (ativo) setImovel(null)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()

    return () => {
      ativo = false
    }
  }, [codigo])

  const capa = imovel ? capaDoImovel(imovel) : null

  usarTituloPagina(imovel ? imovel.titulo : codigo ? `Imóvel ${codigo}` : 'Imóvel', 'publico')
  usarMetadados({
    titulo: imovel ? `${imovel.titulo} · ${imovel.codigo}` : `Imóvel · ${nomeNegocio}`,
    descricao: imovel ? descricaoParaCompartilhar(imovel) : 'Imóvel não encontrado.',
    imagem: capa,
    caminho: `/imovel/${codigo ?? ''}`,
  })

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <EstadoCarregando mensagem="Carregando o imóvel…" />
      </main>
    )
  }

  /**
   * Código sem imóvel ativo correspondente.
   *
   * Não é erro de digitação do visitante: a exclusão de imóvel é
   * definitiva e links de WhatsApp circulam por meses depois de o imóvel
   * sair da carteira. A 404 da vitrine já trata isso pelo que é, e por
   * isso é reaproveitada aqui em vez de uma mensagem genérica.
   */
  if (!imovel) return <NaoEncontradoPublico />

  const fotos = fotosOrdenadas(imovel)
  const badges = badgesDeFinalidade(imovel.finalidade)
  const diferenciais = diferenciaisDoImovel(imovel.caracteristicas)

  return (
    <main className="flex flex-1 flex-col">
      <div className="container-vitrine pb-24 pt-8 sm:pb-16 sm:pt-12">
        {/* ---------------- Migalha ---------------- */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-texto-tenue">
          <Link to="/" className="transition-colors hover:text-texto">
            Início
          </Link>
          <span>/</span>
          <Link to="/imoveis" className="transition-colors hover:text-texto">
            Imóveis
          </Link>
          <span>/</span>
          <span className="truncate text-texto-suave">{imovel.codigo}</span>
        </nav>

        {/* ---------------- Galeria ---------------- */}
        <GaleriaImovel fotos={fotos} titulo={imovel.titulo} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-12">
          {/* ============ Coluna principal ============ */}
          <div className="flex flex-col gap-10">
            {/* Cabeçalho */}
            <header className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {badges.map((finalidade) => (
                  <span
                    key={finalidade}
                    className="rounded-full bg-destaque-suave px-3 py-1 text-xs font-semibold text-destaque"
                  >
                    {ROTULOS_FINALIDADE_VITRINE[finalidade]}
                  </span>
                ))}
                {imovel.tipos_imovel?.nome && (
                  <span className="rounded-full border border-borda px-3 py-1 text-xs font-semibold text-texto-suave">
                    {imovel.tipos_imovel.nome}
                  </span>
                )}
                <span className="ml-auto text-sm font-semibold tracking-wide text-texto-tenue">
                  {imovel.codigo}
                </span>
              </div>

              <h1 className="titulo-secao-vitrine">{imovel.titulo}</h1>

              <p className="flex items-center gap-2 text-base text-texto-suave">
                <MapPin className="size-4 shrink-0 text-texto-tenue" />
                {imovel.bairro}, {imovel.cidade} — {imovel.estado}
              </p>
            </header>

            {/* Características */}
            <section className="grid grid-cols-2 gap-4 rounded-2xl border border-borda bg-superficie-alternativa p-6 sm:grid-cols-3">
              {imovel.quartos > 0 && (
                <Caracteristica icone={BedDouble} valor={String(imovel.quartos)} rotulo={imovel.quartos === 1 ? 'quarto' : 'quartos'} />
              )}
              {imovel.suites > 0 && (
                <Caracteristica icone={DoorOpen} valor={String(imovel.suites)} rotulo={imovel.suites === 1 ? 'suíte' : 'suítes'} />
              )}
              {imovel.banheiros > 0 && (
                <Caracteristica icone={Bath} valor={String(imovel.banheiros)} rotulo={imovel.banheiros === 1 ? 'banheiro' : 'banheiros'} />
              )}
              {imovel.vagas > 0 && (
                <Caracteristica icone={Car} valor={String(imovel.vagas)} rotulo={imovel.vagas === 1 ? 'vaga' : 'vagas'} />
              )}
              {imovel.area_total !== null && (
                <Caracteristica icone={Ruler} valor={formatarArea(imovel.area_total)} rotulo="área total" />
              )}
              {imovel.area_util !== null && (
                <Caracteristica icone={Ruler} valor={formatarArea(imovel.area_util)} rotulo="área útil" />
              )}
              {imovel.mobiliado && <Caracteristica icone={Sofa} valor="Mobiliado" rotulo="pronto para morar" />}
              {imovel.aceita_pet && <Caracteristica icone={PawPrint} valor="Aceita pet" rotulo="animais permitidos" />}
            </section>

            {/* Descrição */}
            {imovel.descricao && (
              <section>
                <h2 className="text-xl font-bold tracking-tight text-texto">Sobre o imóvel</h2>
                <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-texto-suave">
                  {imovel.descricao}
                </p>
              </section>
            )}

            {/* Diferenciais */}
            {diferenciais.length > 0 && (
              <section>
                <h2 className="text-xl font-bold tracking-tight text-texto">Diferenciais</h2>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {diferenciais.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-base text-texto-suave">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destaque-suave">
                        <Check className="size-3 text-destaque" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Localização.
                Bairro, cidade e estado — nunca rua e número. Endereço
                exato de imóvel anunciado é informação sensível: o imóvel
                pode estar vazio, e publicar o número expõe o patrimônio
                do proprietário. Quem precisa do endereço recebe na
                conversa, depois do primeiro contato. */}
            <section>
              <h2 className="text-xl font-bold tracking-tight text-texto">Localização</h2>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-borda p-6">
                <p className="flex items-center gap-2.5 text-base text-texto">
                  <MapPin className="size-4.5 shrink-0 text-destaque" />
                  {imovel.bairro}, {imovel.cidade} — {imovel.estado}
                </p>
                <p className="text-sm leading-relaxed text-texto-suave">
                  O endereço completo é informado no atendimento, ao combinar a visita.
                </p>
                {configuracoes?.link_google_maps && (
                  <a
                    href={urlExterna(configuracoes.link_google_maps)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start text-sm font-semibold text-destaque hover:underline"
                  >
                    Ver onde fica a {nomeNegocio}
                  </a>
                )}
              </div>
            </section>
          </div>

          {/* ============ Coluna de valores ============ */}
          <aside className="lg:sticky lg:top-24">
            <div className="flex flex-col gap-5 rounded-2xl border border-borda bg-superficie p-6 shadow-elevado">
              <div className="flex flex-col gap-4">
                {(imovel.finalidade === 'venda' || imovel.finalidade === 'ambos') &&
                  imovel.valor_venda !== null && (
                    <Valor rotulo="Valor de venda" valor={formatarMoedaCurta(imovel.valor_venda)} principal />
                  )}

                {(imovel.finalidade === 'locacao' || imovel.finalidade === 'ambos') &&
                  imovel.valor_aluguel !== null && (
                    <Valor
                      rotulo="Aluguel"
                      valor={formatarMoedaCurta(imovel.valor_aluguel)}
                      sufixo="/mês"
                      principal
                    />
                  )}
              </div>

              {(imovel.valor_condominio !== null || imovel.valor_iptu !== null) && (
                <div className="flex flex-col gap-2 border-t border-borda pt-4">
                  {imovel.valor_condominio !== null && (
                    <Valor rotulo="Condomínio" valor={formatarMoeda(imovel.valor_condominio)} />
                  )}
                  {imovel.valor_iptu !== null && (
                    <Valor rotulo="IPTU" valor={formatarMoeda(imovel.valor_iptu)} />
                  )}
                </div>
              )}

              <BotaoWhatsapp
                imovel={imovel}
                tamanho="grande"
                className="w-full"
                rotulo="Falar no WhatsApp"
              />

              <p className="text-center text-xs leading-relaxed text-texto-tenue">
                A mensagem já vai com o código <strong>{imovel.codigo}</strong>. Você não precisa
                explicar qual anúncio viu.
              </p>
            </div>
          </aside>
        </div>

        {/* ---------------- Semelhantes ---------------- */}
        {semelhantes.length > 0 && (
          <section className="mt-20">
            <h2 className="titulo-secao-vitrine">Imóveis semelhantes</h2>
            <p className="subtitulo-vitrine mt-3">
              Do mesmo tipo e em faixa de valor parecida.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {semelhantes.map((semelhante) => (
                <CartaoImovelPublico key={semelhante.id} imovel={semelhante} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ---------------- Barra fixa do celular ----------------
          O botão precisa estar sempre ao alcance do polegar: a página do
          imóvel é longa, e no celular o botão da coluna lateral fica
          muito acima depois de duas rolagens. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie/95 p-3 backdrop-blur-md sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-texto-tenue">{imovel.codigo}</p>
            <p className="truncate text-base font-bold tracking-tight text-texto">
              {imovel.finalidade === 'locacao'
                ? `${formatarMoedaCurta(imovel.valor_aluguel)}/mês`
                : formatarMoedaCurta(imovel.valor_venda ?? imovel.valor_aluguel)}
            </p>
          </div>
          <BotaoWhatsapp imovel={imovel} rotulo="WhatsApp" className="shrink-0" />
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------- apoio */

function Caracteristica({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof BedDouble
  valor: string
  rotulo: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-superficie">
        <Icone className="size-4.5 text-destaque" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-texto">{valor}</span>
        <span className="block truncate text-xs text-texto-suave">{rotulo}</span>
      </span>
    </div>
  )
}

function Valor({
  rotulo,
  valor,
  sufixo,
  principal,
}: {
  rotulo: string
  valor: string
  sufixo?: string
  principal?: boolean
}) {
  if (principal) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-texto-tenue">
          {rotulo}
        </span>
        <span className="text-3xl font-bold tracking-tight text-texto">
          {valor}
          {sufixo && <span className="text-lg font-medium text-texto-suave">{sufixo}</span>}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-texto-suave">{rotulo}</span>
      <span className="font-semibold text-texto">{valor}</span>
    </div>
  )
}

/**
 * Descrição da prévia de compartilhamento.
 *
 * É o texto que aparece embaixo da foto quando o link é colado no
 * WhatsApp, então precisa dizer o essencial em uma linha: o que é, onde
 * fica e quanto custa — que é exatamente o que decide se a pessoa toca
 * no link.
 */
function descricaoParaCompartilhar(imovel: ImovelDetalhe): string {
  const partes: string[] = []

  if (imovel.tipos_imovel?.nome) partes.push(imovel.tipos_imovel.nome)
  if (imovel.quartos > 0) partes.push(`${imovel.quartos} ${imovel.quartos === 1 ? 'quarto' : 'quartos'}`)
  if (imovel.vagas > 0) partes.push(`${imovel.vagas} ${imovel.vagas === 1 ? 'vaga' : 'vagas'}`)

  const local = `${imovel.bairro}, ${imovel.cidade}`
  const valor =
    imovel.finalidade === 'locacao'
      ? imovel.valor_aluguel !== null
        ? `${formatarMoedaCurta(imovel.valor_aluguel)}/mês`
        : null
      : imovel.valor_venda !== null
        ? formatarMoedaCurta(imovel.valor_venda)
        : null

  return [partes.join(' · '), local, valor].filter(Boolean).join(' — ')
}
