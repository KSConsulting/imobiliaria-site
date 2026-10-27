import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, Home as IconeCasa } from 'lucide-react'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { usarMetadados } from '@/ganchos/usarMetadados'
import { queryDaBusca } from '@/ganchos/usarFiltrosVitrine'
import { BuscaHero } from '@/componentes/publico/BuscaHero'
import { BotaoWhatsapp } from '@/componentes/publico/BotaoWhatsapp'
import { CartaoImovelPublico } from '@/componentes/publico/CartaoImovelPublico'
import { SobreImobiliaria } from '@/componentes/publico/SobreImobiliaria'
import { CHAMADA_FINAL, HERO, PASSOS, PERGUNTAS } from '@/componentes/publico/textos'
import { Skeleton } from '@/componentes/ui/skeleton'
import {
  capaDoImovel,
  listarDestaques,
  listarLocalidadesVitrine,
  listarTiposComEstoque,
  listarTiposVitrine,
  resumirVitrine,
  type ImovelVitrine,
  type TipoComEstoque,
  type TipoVitrine,
} from '@/lib/publico'
import { cn } from '@/lib/utils'

/**
 * Quantos imóveis a home mostra.
 *
 * Vinte e quatro, e não seis: a home é a página que recebe o tráfego, e
 * seis cartões obrigam a trocar de página antes de o visitante ter
 * qualquer noção do estoque. Com quatro fileiras de seis no desktop, ele
 * rola e decide ali mesmo.
 *
 * O custo é de fotos, não de consulta: `CAMPOS_CARD` já traz só a capa, e
 * os cartões fora da primeira dobra carregam a imagem em `lazy`.
 */
const QUANTIDADE_DESTAQUES = 24

export function Home() {
  const { configuracoes, nomeNegocio } = usarConfiguracoes()

  const [destaques, setDestaques] = useState<ImovelVitrine[]>([])
  const [tipos, setTipos] = useState<TipoVitrine[]>([])
  const [categorias, setCategorias] = useState<TipoComEstoque[]>([])
  const [locais, setLocais] = useState<{ cidades: string[]; bairros: string[] }>({
    cidades: [],
    bairros: [],
  })
  const [resumo, setResumo] = useState<Awaited<ReturnType<typeof resumirVitrine>> | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [trocandoCategoria, setTrocandoCategoria] = useState(false)

  /**
   * A capa do hero é congelada na primeira carga.
   *
   * Sem isso ela sairia de `destaques[0]`, que muda a cada troca de
   * categoria: escolher "Chácara" lá embaixo trocaria a foto da primeira
   * dobra, que está fora da tela. O visitante rolaria de volta para uma
   * página com outra cara e não saberia o que aconteceu.
   */
  const [capaInicial, setCapaInicial] = useState<string | null>(null)

  // A categoria vive na URL, e não em `useState`: é assim que um recorte
  // pode ser mandado por WhatsApp, que é como esta vitrine circula. É a
  // mesma razão de os filtros da listagem e do funil viverem lá.
  const [parametros, definirParametros] = useSearchParams()
  const categoria = parametros.get('tipo')

  usarTituloPagina(undefined, 'publico')
  usarMetadados({
    titulo: `${nomeNegocio} — Imóveis para comprar e alugar`,
    descricao: HERO.subtitulo,
    imagem: capaInicial,
    caminho: '/',
  })

  useEffect(() => {
    void (async () => {
      try {
        const [lista, listaTipos, comEstoque, localidades, numeros] = await Promise.all([
          listarDestaques(QUANTIDADE_DESTAQUES, categoria),
          listarTiposVitrine(),
          listarTiposComEstoque(),
          listarLocalidadesVitrine(),
          resumirVitrine(),
        ])
        setDestaques(lista)
        setTipos(listaTipos)
        setCategorias(comEstoque)
        setLocais(localidades)
        setResumo(numeros)
        setCapaInicial(capaDoImovel(lista[0] ?? { imoveis_fotos: [] }))
      } catch (erro) {
        // A vitrine não exibe erro técnico ao visitante: ela degrada
        // para as seções que não dependem do banco.
        console.warn('[vitrine] falha ao carregar a home:', erro)
      } finally {
        setCarregando(false)
      }
    })()
    // Só na montagem. A troca de categoria tem o efeito abaixo, que
    // recarrega apenas a grade — recarregar tudo faria a faixa de
    // números e os campos de busca piscarem a cada clique num chip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (carregando) return

    let cancelado = false
    setTrocandoCategoria(true)

    void (async () => {
      try {
        const lista = await listarDestaques(QUANTIDADE_DESTAQUES, categoria)
        // Guarda contra resposta fora de ordem: clicando em duas
        // categorias em sequência, a primeira resposta pode chegar
        // depois da segunda e sobrescrever a lista certa.
        if (!cancelado) setDestaques(lista)
      } catch (erro) {
        console.warn('[vitrine] falha ao filtrar por categoria:', erro)
      } finally {
        if (!cancelado) setTrocandoCategoria(false)
      }
    })()

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria])

  /**
   * Quantos imóveis existem na seleção atual, contra quantos cabem na
   * grade.
   *
   * A grade tem teto de 24, e o botão da categoria anuncia o total. Numa
   * carteira de 30, "Todos 30" com 24 cartões na tela é uma contradição
   * que o visitante enxerga sem procurar. Ou o número mentia, ou faltava
   * dizer que ali é um recorte — e a segunda é a verdade.
   */
  const totalDaSelecao = categoria
    ? (categorias.find((tipo) => tipo.id === categoria)?.total ?? 0)
    : categorias.reduce((soma, tipo) => soma + tipo.total, 0)

  const temMaisQueOTeto = !carregando && !trocandoCategoria && totalDaSelecao > destaques.length

  function escolherCategoria(id: string | null) {
    const novos = new URLSearchParams(parametros)
    if (id) novos.set('tipo', id)
    else novos.delete('tipo')
    // `replace`: trocar de categoria não é navegação, e empilhar cada
    // clique no histórico faria o botão "voltar" percorrer os chips um a
    // um antes de sair da home.
    definirParametros(novos, { replace: true })
  }

  /**
   * Foto da primeira dobra.
   *
   * Ordem de preferência: a foto definida nas Configurações, a capa do
   * primeiro imóvel carregado, e por último o fundo sólido na cor de
   * destaque. O último caso é o da imobiliária que acabou de entrar no ar
   * e ainda não cadastrou imóvel — e ali um espaço vazio pareceria site
   * quebrado, que é a pior primeira impressão possível.
   */
  const fotoHero = configuracoes?.foto_hero_url ?? capaInicial

  return (
    <main className="flex flex-1 flex-col">
      {/* ================= Hero ================= */}
      <section className="relative isolate flex min-h-[42rem] flex-col justify-end overflow-hidden sm:min-h-[44rem]">
        {fotoHero ? (
          <>
            <img
              src={fotoHero}
              alt=""
              // Primeira imagem da dobra: carrega imediatamente, sem
              // lazy. Ela é o próprio conteúdo da primeira tela.
              fetchPriority="high"
              // Em luminosidade e a 45%: a foto vira textura sob o texto,
              // como no Lumina, e qualquer foto de fachada, de qualquer
              // cor, assenta no mesmo preto.
              className="absolute inset-0 -z-20 size-full object-cover opacity-45 mix-blend-luminosity"
            />
            {/* Véu: escurece o topo, sob o cabeçalho, e funde a base no
                fundo da página, para o hero não terminar numa linha reta. */}
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-b from-fundo/90 via-fundo/55 to-fundo"
              aria-hidden
            />
          </>
        ) : null}
        {/* Brilho da marca e feixes, com ou sem foto */}
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_25%_30%,color-mix(in_oklab,var(--cor-destaque)_20%,transparent),transparent_60%)]"
          aria-hidden
        />
        <div className="feixes absolute inset-0 -z-10 mx-auto max-w-7xl" aria-hidden />

        <div className="container-vitrine pb-10 pt-28 sm:pb-14">
          {/* Chips de tipo.
              Levam à grade filtrada **desta mesma página**, e não à
              listagem: com o seletor de categorias logo abaixo, dois
              conjuntos de chips com os mesmos nomes fazendo coisas
              diferentes na mesma tela seria a definição de armadilha.
              Como a categoria vive na URL, o link continua sendo link,
              compartilhável, e a âncora leva o visitante direto à grade. */}
          {categorias.length > 0 && (
            <div className="mb-7 flex flex-wrap gap-2">
              {categorias.slice(0, 7).map((tipo) => (
                <Link
                  key={tipo.id}
                  to={`/?tipo=${tipo.id}#imoveis`}
                  className="rounded-full border border-claro/35 bg-claro/12 px-4 py-1.5 text-sm font-medium text-claro backdrop-blur-sm transition-colors hover:bg-claro/25"
                >
                  {tipo.nome}
                </Link>
              ))}
            </div>
          )}

          <h1 className="titulo-vitrine max-w-4xl text-claro">{HERO.titulo}</h1>
          <p className="subtitulo-vitrine mt-6 max-w-xl font-medium text-claro/60">{HERO.subtitulo}</p>

          <div className="mt-9 max-w-4xl">
            <BuscaHero tipos={tipos} cidades={locais.cidades} bairros={locais.bairros} />
          </div>
        </div>
      </section>

      {/* ================= Números reais ================= */}
      {resumo && resumo.imoveis > 0 && (
        <section className="border-y border-borda bg-fundo">
          <div className="container-vitrine grid grid-cols-2 gap-6 py-9 sm:grid-cols-4">
            <Numero valor={resumo.imoveis} rotulo={resumo.imoveis === 1 ? 'imóvel disponível' : 'imóveis disponíveis'} />
            {resumo.paraVenda > 0 && <Numero valor={resumo.paraVenda} rotulo="à venda" />}
            {resumo.paraLocacao > 0 && <Numero valor={resumo.paraLocacao} rotulo="para alugar" />}
            {resumo.cidades > 0 && (
              <Numero
                valor={resumo.cidades}
                rotulo={resumo.cidades === 1 ? 'cidade atendida' : 'cidades atendidas'}
              />
            )}
          </div>
        </section>
      )}

      {/* ================= Imóveis ================= */}
      <section id="imoveis" className="secao-vitrine scroll-mt-24">
        <div className="container-vitrine">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="titulo-secao-vitrine">Imóveis disponíveis</h2>
              <p className="subtitulo-vitrine mt-3">
                Os cadastros mais recentes da nossa carteira. Todos disponíveis agora, com visita
                que pode ser marcada pelo WhatsApp.
              </p>
            </div>

            <Link
              to={`/imoveis${categoria ? queryDaBusca({ tipo: categoria }) : ''}`}
              className="inline-flex shrink-0 items-center gap-2 text-base font-semibold text-destaque hover:underline"
            >
              Ver todos
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Seletor de categorias.
              Rola na horizontal no celular em vez de quebrar em três
              linhas de botões, que empurrariam o primeiro imóvel para
              fora da tela justamente na largura em que ele mais custa. */}
          {categorias.length > 0 && (
            <div className="-mx-4 mt-8 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                <BotaoCategoria
                  rotulo="Todos"
                  total={categorias.reduce((soma, tipo) => soma + tipo.total, 0)}
                  ativo={!categoria}
                  aoEscolher={() => escolherCategoria(null)}
                />
                {categorias.map((tipo) => (
                  <BotaoCategoria
                    key={tipo.id}
                    rotulo={tipo.nome}
                    total={tipo.total}
                    ativo={categoria === tipo.id}
                    aoEscolher={() => escolherCategoria(tipo.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {carregando || trocandoCategoria ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-borda">
                  <Skeleton className="aspect-4/3 w-full rounded-none" />
                  <div className="flex flex-col gap-3 p-5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-5 w-2/5" />
                  </div>
                </div>
              ))
            ) : destaques.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-borda-forte px-6 py-16 text-center">
                <IconeCasa className="mx-auto size-8 text-texto-tenue" strokeWidth={1.5} />
                {/* Dois vazios distintos. "Nenhum imóvel publicado" numa
                    categoria filtrada faria o visitante concluir que a
                    imobiliária inteira está sem estoque, quando o que
                    faltou foi aquele tipo. */}
                <p className="mt-4 text-base font-semibold text-texto">
                  {categoria
                    ? 'Nenhum imóvel nesta categoria agora'
                    : 'Nenhum imóvel publicado no momento'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texto-suave">
                  Estamos atualizando a carteira. Fale com a gente no WhatsApp e conte o que você
                  procura — muitas vezes temos algo antes de publicar.
                </p>
                <div className="mt-7 flex justify-center">
                  <BotaoWhatsapp />
                </div>
              </div>
            ) : (
              destaques.map((imovel, indice) => (
                <CartaoImovelPublico
                  key={imovel.id}
                  imovel={imovel}
                  prioritaria={indice < 3}
                />
              ))
            )}
          </div>

          {temMaisQueOTeto && (
            <div className="mt-10 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-texto-suave">
                Mostrando {destaques.length} de {totalDaSelecao} imóveis.
              </p>
              <Link
                to={`/imoveis${categoria ? queryDaBusca({ tipo: categoria }) : ''}`}
                className="inline-flex items-center gap-2 rounded-full border border-borda-forte px-5 py-2.5 text-base font-semibold text-texto transition-colors hover:border-destaque hover:text-destaque"
              >
                Ver todos os imóveis
                <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ================= Como funciona ================= */}
      <section className="border-y border-borda bg-superficie-alternativa">
        <div className="container-vitrine secao-vitrine">
          <div className="max-w-xl">
            <h2 className="titulo-secao-vitrine">Como funciona</h2>
            <p className="subtitulo-vitrine mt-3">
              Do anúncio à visita em três passos. Sem formulário, sem cadastro e sem esperar
              retorno por email.
            </p>
          </div>

          <ol className="mt-11 grid gap-8 sm:grid-cols-3">
            {PASSOS.map(({ icone: Icone, titulo, texto }, indice) => (
              <li key={titulo} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-destaque-suave">
                    <Icone className="size-5.5 text-destaque" strokeWidth={1.8} />
                  </span>
                  <span className="text-sm font-bold text-texto-tenue">0{indice + 1}</span>
                </div>
                <h3 className="text-lg font-semibold text-texto">{titulo}</h3>
                <p className="text-base leading-relaxed text-texto-suave">{texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= Perguntas frequentes ================= */}
      <section className="secao-vitrine">
        <div className="container-vitrine grid gap-10 lg:grid-cols-[22rem_1fr] lg:gap-16">
          <div>
            <h2 className="titulo-secao-vitrine">Perguntas frequentes</h2>
            <p className="subtitulo-vitrine mt-3">
              O que mais perguntam antes da primeira visita. Ficou alguma dúvida? Chame no
              WhatsApp.
            </p>
            <div className="mt-7">
              <BotaoWhatsapp rotulo="Tirar uma dúvida" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {PERGUNTAS.map((item) => (
              <ItemPergunta key={item.pergunta} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= Chamada final ================= */}
      <section className="relative isolate overflow-hidden">
        {fotoHero ? (
          <>
            <img
              src={fotoHero}
              alt=""
              loading="lazy"
              className="absolute inset-0 -z-20 size-full object-cover opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-fundo via-fundo/60 to-fundo" aria-hidden />
          </>
        ) : null}
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--cor-destaque)_18%,transparent),transparent_65%)]"
          aria-hidden
        />

        <div className="container-vitrine secao-vitrine text-center">
          <h2 className="titulo-secao-vitrine mx-auto max-w-2xl text-claro">
            {CHAMADA_FINAL.titulo}
          </h2>
          <p className="subtitulo-vitrine mx-auto mt-4 max-w-xl text-claro/60">
            {CHAMADA_FINAL.texto}
          </p>
          <div className="mt-9 flex justify-center">
            <BotaoWhatsapp tamanho="grande" rotulo="Falar no WhatsApp" />
          </div>
        </div>
      </section>

      {/* ================= Sobre a imobiliária ================= */}
      <SobreImobiliaria />
    </main>
  )
}

/* ------------------------------------------------------------- apoio */

/**
 * Um botão de categoria.
 *
 * **O número ao lado do nome não é enfeite.** Ele diz de antemão o
 * tamanho do que há por trás de cada categoria, e é o que evita o clique
 * que abre uma tela quase vazia. Numa carteira com 20 apartamentos e 2
 * coberturas, saber disso antes muda por onde o visitante começa.
 */
function BotaoCategoria({
  rotulo,
  total,
  ativo,
  aoEscolher,
}: {
  rotulo: string
  total: number
  ativo: boolean
  aoEscolher: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={ativo}
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        ativo
          ? 'border-destaque bg-destaque text-destaque-contraste'
          : 'border-borda bg-superficie text-texto-suave hover:border-borda-forte hover:text-texto',
      )}
    >
      {rotulo}
      <span className={cn('text-xs tabular-nums', ativo ? 'opacity-75' : 'text-texto-tenue')}>
        {total}
      </span>
    </button>
  )
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-5xl font-light leading-none tracking-tighter text-texto tabular-nums sm:text-6xl">
        {valor}
      </span>
      <span className="text-sm font-medium text-texto-tenue">{rotulo}</span>
    </div>
  )
}

/**
 * Item do acordeão.
 *
 * Usa `<details>` nativo: abre e fecha sem JavaScript, é acessível por
 * teclado de graça e o conteúdo continua no HTML para quem lê a página
 * com leitor de tela.
 */
function ItemPergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className="group rounded-xl border border-borda bg-superficie px-5 open:shadow-cartao">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 py-4.5',
          'text-base font-semibold text-texto marker:hidden',
        )}
      >
        {pergunta}
        <ChevronDown className="size-5 shrink-0 text-texto-tenue transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-5 pr-8 text-base leading-relaxed text-texto-suave">{resposta}</p>
    </details>
  )
}
