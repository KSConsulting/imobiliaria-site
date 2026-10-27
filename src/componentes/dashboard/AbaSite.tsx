import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Eye, FileText, MessageCircle, PieChart } from 'lucide-react'
import { BlocoDashboard } from '@/componentes/dashboard/BlocoDashboard'
import { GraficoBarras, GraficoRosca } from '@/componentes/dashboard/Graficos'
import { Button } from '@/componentes/ui/button'
import { usarBloco } from '@/ganchos/usarBloco'
import {
  buscarEstoque,
  buscarEstoquePorTipo,
  buscarPaginas,
  buscarRanking,
  formatarNumero,
  formatarPercentual,
  type LinhaRanking,
  type Periodo,
  type TipoRanking,
} from '@/lib/dashboard'
import { cn } from '@/lib/utils'

const LIMITE_INICIAL = 10
const LIMITE_EXPANDIDO = 30

/**
 * Cores da rosca de tipos: o destaque, cada vez mais misturado ao cinza.
 * Derivadas da variável e não escritas como valor, para acompanharem a
 * troca de --cor-destaque. Escritas à mão, eram o último verde que
 * sobrava no painel depois da troca para o laranja.
 */
const CORES_TIPOS = [100, 82, 66, 52, 40, 30, 22].map(
  (pct) => `color-mix(in oklab, var(--cor-destaque) ${pct}%, var(--texto-tenue))`,
)

export function AbaSite({ periodo }: { periodo: Periodo }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Ranking periodo={periodo} evento="visualizacao" />
      <Ranking periodo={periodo} evento="clique_whatsapp" />
      <Paginas periodo={periodo} />
      <Estoque />
    </div>
  )
}

/* ==================================================================== */
/* Rankings                                                              */
/* ==================================================================== */

function Ranking({ periodo, evento }: { periodo: Periodo; evento: TipoRanking }) {
  const [limite, setLimite] = useState(LIMITE_INICIAL)
  const bloco = usarBloco(
    () => buscarRanking(periodo, evento, limite),
    [periodo.inicio, periodo.fim, evento, limite],
  )

  const porCliques = evento === 'clique_whatsapp'
  const linhas = bloco.dados ?? []

  return (
    <BlocoDashboard
      titulo={porCliques ? 'Mais cliques no WhatsApp' : 'Mais visualizados'}
      descricao={
        porCliques
          ? 'Ordenado por cliques no período. A conversão é cliques ÷ visualizações.'
          : 'Ordenado por visualizações no período.'
      }
      icone={porCliques ? MessageCircle : Eye}
      carregando={bloco.carregando}
      erro={bloco.erro}
      aoRecarregar={bloco.recarregar}
      vazio={linhas.length === 0}
      mensagemVazio={
        porCliques
          ? 'Nenhum clique no WhatsApp nesse período. Se houve visitas ao site, vale rever preço e fotos dos imóveis mais vistos.'
          : 'Nenhuma visualização de imóvel nesse período.'
      }
      alturaEsqueleto={280}
      acao={
        linhas.length >= limite && limite === LIMITE_INICIAL ? (
          <Button variante="fantasma" tamanho="pequeno" onClick={() => setLimite(LIMITE_EXPANDIDO)}>
            Ver lista completa
          </Button>
        ) : limite > LIMITE_INICIAL ? (
          <Button variante="fantasma" tamanho="pequeno" onClick={() => setLimite(LIMITE_INICIAL)}>
            Ver menos
          </Button>
        ) : undefined
      }
    >
      <ol className="flex flex-col divide-y divide-borda">
        {linhas.map((linha, indice) => (
          <ItemRanking
            key={linha.id_imovel}
            linha={linha}
            posicao={indice + 1}
            destacarCliques={porCliques}
          />
        ))}
      </ol>
    </BlocoDashboard>
  )
}

function ItemRanking({
  linha,
  posicao,
  destacarCliques,
}: {
  linha: LinhaRanking
  posicao: number
  destacarCliques: boolean
}) {
  return (
    <li>
      <Link
        to={`/painel/imoveis/${linha.id_imovel}/editar`}
        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-superficie-alternativa"
      >
        <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-texto-tenue">
          {posicao}
        </span>

        {linha.url_capa ? (
          <img
            src={linha.url_capa}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-superficie-alternativa text-[0.625rem] text-texto-tenue">
            sem foto
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-texto">{linha.titulo}</span>
          <span className="block truncate text-xs text-texto-suave">
            {linha.codigo} · {linha.bairro}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-texto">
            {formatarNumero(destacarCliques ? linha.cliques : linha.visualizacoes)}
          </span>
          <span className="block text-xs text-texto-tenue">
            {destacarCliques ? 'cliques' : 'visualizações'}
          </span>
        </span>

        {/* A conversão é o número mais acionável da aba: muito visto com
            pouco clique é problema de preço ou de foto; pouco visto com
            muito clique merece destaque na home. */}
        {destacarCliques && (
          <span
            className={cn(
              'w-16 shrink-0 rounded-full px-2 py-1 text-center text-xs font-semibold tabular-nums',
              linha.conversao === null
                ? 'bg-superficie-alternativa text-texto-tenue'
                : linha.conversao >= 10
                  ? 'bg-sucesso/12 text-sucesso'
                  : linha.conversao >= 3
                    ? 'bg-alerta/15 text-alerta'
                    : 'bg-destrutivo/10 text-destrutivo',
            )}
            title="Cliques no WhatsApp dividido por visualizações"
          >
            {linha.conversao === null ? '—' : formatarPercentual(linha.conversao)}
          </span>
        )}
      </Link>
    </li>
  )
}

/* ==================================================================== */
/* Páginas                                                               */
/* ==================================================================== */

function Paginas({ periodo }: { periodo: Periodo }) {
  const bloco = usarBloco(() => buscarPaginas(periodo), [periodo.inicio, periodo.fim])
  const linhas = bloco.dados ?? []
  const total = linhas.reduce((soma, l) => soma + l.acessos, 0)

  return (
    <BlocoDashboard
      titulo="Páginas mais acessadas"
      descricao="As páginas de imóvel individual entram somadas numa linha só."
      icone={FileText}
      carregando={bloco.carregando}
      erro={bloco.erro}
      aoRecarregar={bloco.recarregar}
      vazio={linhas.length === 0}
      mensagemVazio="Nenhum acesso ao site nesse período. Se o site acabou de entrar no ar, ainda não houve tempo de aparecer no Google."
      alturaEsqueleto={220}
    >
      <>
        <GraficoBarras
          itens={linhas.slice(0, 8).map((linha) => ({
            rotulo: linha.agregada ? 'Páginas de imóvel (todas)' : rotularPagina(linha.pagina),
            valor: linha.acessos,
          }))}
        />
        <p className="mt-4 border-t border-borda pt-3 text-xs text-texto-tenue">
          {formatarNumero(total)} acessos no período
        </p>
      </>
    </BlocoDashboard>
  )
}

/** `/` vira "Página inicial"; o resto fica como está, que é legível. */
function rotularPagina(caminho: string): string {
  if (caminho === '/') return 'Página inicial'
  if (caminho === '/imoveis') return 'Listagem de imóveis'
  return caminho
}

/* ==================================================================== */
/* Estoque                                                               */
/* ==================================================================== */

function Estoque() {
  const estoque = usarBloco(() => buscarEstoque(), [])
  const tipos = usarBloco(() => buscarEstoquePorTipo(), [])

  const dados = estoque.dados
  const listaTipos = tipos.dados ?? []

  return (
    <BlocoDashboard
      titulo="Resumo de estoque"
      // Estes números são do AGORA e estão na mesma tela que os do
      // período. Sem dizer isso, o dono lê "12 imóveis ativos" como
      // "12 imóveis cadastrados nos últimos 30 dias".
      descricao="Situação atual da carteira. Não muda com o período selecionado."
      icone={Boxes}
      carregando={estoque.carregando}
      erro={estoque.erro}
      aoRecarregar={estoque.recarregar}
      vazio={!!dados && dados.ativos === 0 && dados.inativos === 0}
      mensagemVazio="Nenhum imóvel cadastrado ainda."
      alturaEsqueleto={260}
    >
      {dados && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Numero rotulo="Ativos" valor={dados.ativos} destaque />
            <Numero rotulo="Inativos" valor={dados.inativos} />
            <Numero rotulo="À venda" valor={dados.venda} />
            <Numero rotulo="Para alugar" valor={dados.locacao} />
            {dados.ambos > 0 && <Numero rotulo="Venda e locação" valor={dados.ambos} />}
            {/* Imóvel ativo sem foto aparece na vitrine como retângulo
                cinza e quase nunca é clicado. É um problema silencioso —
                por isso vira alerta em vez de mais um número. */}
            {dados.sem_foto > 0 && (
              <Numero rotulo="Ativos sem foto" valor={dados.sem_foto} alerta />
            )}
          </div>

          {listaTipos.length > 0 && (
            <div className="border-t border-borda pt-5">
              <h4 className="rotulo-grupo mb-4 flex items-center gap-2">
                <PieChart className="size-3.5" />
                Por tipo de imóvel
              </h4>
              <GraficoRosca
                fatias={listaTipos.map((linha, i) => ({
                  rotulo: linha.tipo,
                  valor: linha.total,
                  cor: CORES_TIPOS[i % CORES_TIPOS.length],
                }))}
                total={dados.ativos}
                rotuloTotal="ativos"
              />
            </div>
          )}
        </div>
      )}
    </BlocoDashboard>
  )
}

function Numero({
  rotulo,
  valor,
  destaque,
  alerta,
}: {
  rotulo: string
  valor: number
  destaque?: boolean
  alerta?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-lg border px-3.5 py-3',
        alerta ? 'border-alerta/30 bg-alerta/8' : 'border-borda',
      )}
    >
      <span
        className={cn(
          'text-2xl font-bold tracking-tight tabular-nums',
          alerta ? 'text-alerta' : destaque ? 'text-destaque' : 'text-texto',
        )}
      >
        {formatarNumero(valor)}
      </span>
      <span className="text-xs text-texto-suave">{rotulo}</span>
    </div>
  )
}
