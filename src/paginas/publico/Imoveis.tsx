import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, SearchX } from 'lucide-react'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { usarMetadados } from '@/ganchos/usarMetadados'
import { usarFiltrosVitrine } from '@/ganchos/usarFiltrosVitrine'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { FiltrosVitrine } from '@/componentes/publico/FiltrosVitrine'
import { CartaoImovelPublico } from '@/componentes/publico/CartaoImovelPublico'
import { BotaoWhatsapp } from '@/componentes/publico/BotaoWhatsapp'
import { Skeleton } from '@/componentes/ui/skeleton'
import {
  listarImoveisVitrine,
  listarLocalidadesVitrine,
  listarTiposVitrine,
  PAGINA_VITRINE,
  temFiltroVitrineAtivo,
  type ImovelVitrine,
  type TipoVitrine,
} from '@/lib/publico'

export function ImoveisPublico() {
  const { nomeNegocio } = usarConfiguracoes()
  const { filtros, definirFiltro, limparFiltros } = usarFiltrosVitrine()

  const [imoveis, setImoveis] = useState<ImovelVitrine[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const [tipos, setTipos] = useState<TipoVitrine[]>([])
  const [locais, setLocais] = useState<{ cidades: string[]; bairros: string[] }>({
    cidades: [],
    bairros: [],
  })

  const temFiltro = useMemo(() => temFiltroVitrineAtivo(filtros), [filtros])

  usarTituloPagina('Imóveis', 'publico')
  usarMetadados({
    titulo: `Imóveis · ${nomeNegocio}`,
    descricao: 'Encontre imóveis para comprar e alugar. Filtre por bairro, valor e quartos.',
    caminho: '/imoveis',
  })

  /**
   * Primeira página.
   *
   * Sempre substitui a lista, nunca acrescenta: mudou o filtro, mudou o
   * conjunto. Acrescentar aqui misturaria resultado de dois filtros
   * diferentes na mesma tela.
   */
  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const pagina = await listarImoveisVitrine(filtros, 0, PAGINA_VITRINE)
      setImoveis(pagina.imoveis)
      setTotal(pagina.total)
    } catch (erro) {
      console.warn('[vitrine] falha ao listar imóveis:', erro)
      setImoveis([])
      setTotal(0)
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    void (async () => {
      try {
        const [listaTipos, localidades] = await Promise.all([
          listarTiposVitrine(),
          listarLocalidadesVitrine(),
        ])
        setTipos(listaTipos)
        setLocais(localidades)
      } catch (erro) {
        console.warn('[vitrine] falha ao carregar os filtros:', erro)
      }
    })()
  }, [])

  /**
   * Próxima página.
   *
   * Botão explícito, e não rolagem infinita: no celular a rolagem
   * infinita afasta o rodapé para sempre, e é lá que estão o telefone e
   * o endereço da imobiliária. Paginação numerada também está fora —
   * alvo pequeno demais para o dedo.
   */
  async function carregarMais() {
    if (carregandoMais) return
    setCarregandoMais(true)
    try {
      const pagina = await listarImoveisVitrine(filtros, imoveis.length, PAGINA_VITRINE)
      setImoveis((atuais) => {
        // Deduplica: entre uma página e outra um imóvel pode ter sido
        // desativado no painel, deslocando a janela do `range`.
        const vistos = new Set(atuais.map((i) => i.id))
        return [...atuais, ...pagina.imoveis.filter((i) => !vistos.has(i.id))]
      })
      setTotal(pagina.total)
    } catch (erro) {
      console.warn('[vitrine] falha ao carregar mais:', erro)
    } finally {
      setCarregandoMais(false)
    }
  }

  const restam = total - imoveis.length

  return (
    <main className="flex flex-1 flex-col">
      <div className="container-vitrine pb-16 pt-10 sm:pt-14">
        {/* ---------------- Cabeçalho ---------------- */}
        <div className="max-w-2xl">
          <h1 className="titulo-secao-vitrine">Imóveis disponíveis</h1>
          <p className="subtitulo-vitrine mt-3">
            Todos os imóveis da nossa carteira, atualizados em tempo real. Filtre e mande o link
            para quem decide com você.
          </p>
        </div>

        {/* ---------------- Filtros ---------------- */}
        <div className="mt-8">
          <FiltrosVitrine
            filtros={filtros}
            definirFiltro={definirFiltro}
            limparFiltros={limparFiltros}
            tipos={tipos}
            cidades={locais.cidades}
            bairros={locais.bairros}
            temFiltro={temFiltro}
          />
        </div>

        {/* ---------------- Contagem ---------------- */}
        {!carregando && total > 0 && (
          <p className="mt-6 text-sm text-texto-suave">
            {total === 1 ? '1 imóvel encontrado' : `${total} imóveis encontrados`}
            {/* Ordenar por preço sem escolher comprar ou alugar compara
                valor de venda com valor de aluguel, o que não significa
                nada. Melhor dizer qual coluna está sendo usada do que
                deixar o visitante concluir que a ordenação está quebrada. */}
            {filtros.ordem && !filtros.finalidade && (
              <span className="text-texto-tenue">
                {' '}
                · ordenado por valor de venda. Escolha <strong>Alugar</strong> para ordenar pelo
                aluguel.
              </span>
            )}
          </p>
        )}

        {/* ---------------- Grade ---------------- */}
        {carregando ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-borda">
                <Skeleton className="aspect-4/3 w-full rounded-none" />
                <div className="flex flex-col gap-3 p-5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-5 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : imoveis.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-borda-forte px-6 py-20 text-center">
            <SearchX className="mx-auto size-9 text-texto-tenue" strokeWidth={1.4} />
            <h2 className="mt-5 text-xl font-semibold text-texto">
              {temFiltro ? 'Nenhum imóvel com esses critérios' : 'Nenhum imóvel publicado ainda'}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-texto-suave">
              {temFiltro
                ? 'Tente ampliar a busca: outro bairro, uma faixa de valor mais larga ou menos quartos. Se preferir, conte para a gente o que procura.'
                : 'Estamos atualizando a carteira. Fale com a gente e conte o que você procura: muitas vezes temos algo antes de publicar.'}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {temFiltro && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-borda-forte px-6 text-sm font-semibold text-texto transition-colors hover:bg-superficie-alternativa"
                >
                  Limpar filtros
                </button>
              )}
              <BotaoWhatsapp rotulo="Contar o que procuro" />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {imoveis.map((imovel, indice) => (
                <CartaoImovelPublico
                  key={imovel.id}
                  imovel={imovel}
                  prioritaria={indice < 4}
                />
              ))}
            </div>

            {restam > 0 && (
              <div className="mt-12 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => void carregarMais()}
                  disabled={carregandoMais}
                  className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-borda-forte px-8 text-base font-semibold text-texto transition-colors hover:bg-superficie-alternativa disabled:cursor-default disabled:opacity-70"
                >
                  {carregandoMais && <Loader2 className="size-4 animate-spin" />}
                  {carregandoMais ? 'Carregando…' : 'Ver mais imóveis'}
                </button>
                <p className="text-sm text-texto-tenue">
                  Exibindo {imoveis.length} de {total}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
