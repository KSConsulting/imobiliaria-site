import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, LayoutGrid, List, Plus, SearchX } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { EsqueletoCartoes } from '@/componentes/EstadoCarregando'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { BarraFiltros } from '@/componentes/imoveis/BarraFiltros'
import { CartaoImovel } from '@/componentes/imoveis/CartaoImovel'
import { ListaImoveis } from '@/componentes/imoveis/ListaImoveis'
import { ModalDesativacao } from '@/componentes/imoveis/ModalDesativacao'
import { usarFiltrosImovel, usarVisualizacao } from '@/ganchos/usarFiltrosImovel'
import {
  alterarStatus,
  contarImoveis,
  contarVisitasAgendadas,
  excluirImovel,
  listarImoveis,
  listarLocalidades,
  listarTiposImovel,
  temFiltroAtivo,
  type ImovelComRelacoes,
  type TipoImovel,
} from '@/lib/imoveis'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

export function Imoveis() {
  const navegar = useNavigate()
  const { filtros, definirFiltro, limparFiltros } = usarFiltrosImovel()
  const { visualizacao, definirVisualizacao } = usarVisualizacao()

  const [imoveis, setImoveis] = useState<ImovelComRelacoes[]>([])
  const [tipos, setTipos] = useState<TipoImovel[]>([])
  const [localidades, setLocalidades] = useState<{ cidades: string[]; bairros: string[] }>({
    cidades: [],
    bairros: [],
  })
  const [carregando, setCarregando] = useState(true)
  const [totalCadastrado, setTotalCadastrado] = useState(0)

  const [paraDesativar, setParaDesativar] = useState<ImovelComRelacoes | null>(null)
  const [paraExcluir, setParaExcluir] = useState<ImovelComRelacoes | null>(null)
  const [visitasDoExcluir, setVisitasDoExcluir] = useState(0)

  const filtroAtivo = useMemo(() => temFiltroAtivo(filtros), [filtros])

  const carregar = useCallback(async () => {
    try {
      const lista = await listarImoveis(filtros)
      setImoveis(lista)
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os imóveis.')
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  // Debounce só da busca por texto: os selects aplicam na hora.
  useEffect(() => {
    const atraso = filtros.busca ? 300 : 0
    const tempo = setTimeout(() => void carregar(), atraso)
    return () => clearTimeout(tempo)
  }, [carregar, filtros.busca])

  useEffect(() => {
    void (async () => {
      try {
        const [listaTipos, locais] = await Promise.all([listarTiposImovel(), listarLocalidades()])
        setTipos(listaTipos)
        setLocalidades(locais)
      } catch (erro) {
        console.warn('[imoveis] falha ao carregar filtros:', erro)
      }
    })()
  }, [])

  // Distingue "nenhum imóvel cadastrado" de "nenhum resultado para o
  // filtro" — os dois estados vazios pedem ações opostas. Contagem
  // barata, sem trazer linha nenhuma.
  const recontarTotal = useCallback(async () => {
    try {
      setTotalCadastrado(await contarImoveis())
    } catch {
      /* silencioso: só alimenta a escolha do estado vazio */
    }
  }, [])

  useEffect(() => {
    void recontarTotal()
  }, [recontarTotal])

  async function confirmarDesativacao(imovel: ImovelComRelacoes) {
    const novo = imovel.status === 'ativo' ? 'inativo' : 'ativo'
    try {
      await alterarStatus(imovel, novo)
      notificar.sucesso(
        novo === 'inativo' ? 'Imóvel desativado' : 'Imóvel reativado',
        novo === 'inativo'
          ? `${imovel.codigo} saiu da vitrine. O cadastro segue aqui, intacto.`
          : `${imovel.codigo} voltou a aparecer no site.`,
      )
      setParaDesativar(null)
      await carregar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível alterar o status.')
    }
  }

  async function abrirExclusao(imovel: ImovelComRelacoes) {
    setParaExcluir(imovel)
    setVisitasDoExcluir(await contarVisitasAgendadas(imovel.id))
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirImovel(paraExcluir)
      notificar.sucesso(
        'Imóvel excluído',
        `${paraExcluir.codigo} foi removido do banco em definitivo.`,
      )
      setParaExcluir(null)
      await Promise.all([carregar(), recontarTotal()])
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível excluir o imóvel.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Cabeçalho ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Imóveis</h2>
          <p className="texto-apoio">
            A carteira que alimenta o site público e a API. O código é gerado
            automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AlternadorVisualizacao valor={visualizacao} aoMudar={definirVisualizacao} />
          <Button asChild>
            <Link to="/painel/imoveis/novo">
              <Plus className="size-4" />
              Novo imóvel
            </Link>
          </Button>
        </div>
      </div>

      <BarraFiltros
        filtros={filtros}
        definirFiltro={definirFiltro}
        limparFiltros={limparFiltros}
        tipos={tipos}
        cidades={localidades.cidades}
        bairros={localidades.bairros}
        temFiltro={filtroAtivo}
      />

      {!carregando && imoveis.length > 0 && (
        <p className="-mb-2 text-sm text-texto-suave">
          {imoveis.length === 1
            ? '1 imóvel encontrado'
            : `${imoveis.length} imóveis encontrados`}
          {filtroAtivo && totalCadastrado > 0 && (
            <span className="text-texto-tenue"> de {totalCadastrado} cadastrados</span>
          )}
        </p>
      )}

      {/* ---------- Conteúdo ---------- */}
      {carregando ? (
        <EsqueletoCartoes quantidade={6} />
      ) : imoveis.length === 0 ? (
        filtroAtivo ? (
          <div className="cartao">
            <EstadoVazio
              icone={SearchX}
              titulo="Nenhum imóvel para esses filtros"
              descricao="Nenhum dos imóveis cadastrados corresponde à combinação de filtros aplicada. Tente afrouxar algum critério."
              acao={{ rotulo: 'Limpar filtros', aoClicar: limparFiltros }}
            />
          </div>
        ) : (
          <div className="cartao">
            <EstadoVazio
              icone={Building2}
              titulo="Nenhum imóvel cadastrado"
              descricao="Cadastre o primeiro imóvel da carteira. Ele aparece na vitrine assim que for salvo como ativo, sem publicação manual."
              acao={{
                rotulo: 'Cadastrar primeiro imóvel',
                aoClicar: () => navegar('/painel/imoveis/novo'),
              }}
            />
          </div>
        )
      ) : visualizacao === 'grade' ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {imoveis.map((imovel) => (
            <CartaoImovel
              key={imovel.id}
              imovel={imovel}
              aoAlternarStatus={setParaDesativar}
              aoExcluir={(i) => void abrirExclusao(i)}
            />
          ))}
        </div>
      ) : (
        <ListaImoveis
          imoveis={imoveis}
          aoAlternarStatus={setParaDesativar}
          aoExcluir={(i) => void abrirExclusao(i)}
        />
      )}

      {/* ---------- Modais ---------- */}
      <ModalDesativacao
        imovel={paraDesativar}
        aoFechar={() => setParaDesativar(null)}
        aoConfirmar={confirmarDesativacao}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="imóvel"
          nomeItem={paraExcluir.titulo}
          valorConfirmacao={paraExcluir.codigo}
          exigirDigitacao
          aviso={montarAviso(paraExcluir.imoveis_fotos?.length ?? 0, visitasDoExcluir)}
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}

/**
 * Aviso da exclusão definitiva.
 *
 * As visitas agendadas são a consequência menos óbvia e a que mais gera
 * confusão depois: elas continuam na agenda do corretor, mas sem imóvel
 * vinculado. O `codigo_imovel` copiado no agendamento é o que mantém o
 * histórico legível — ver BANCO.md.
 */
function montarAviso(fotos: number, visitas: number): string {
  const partes = [
    'Esta ação é definitiva: não existe lixeira nem recuperação. O registro sai do banco e some do painel, do site e da API.',
  ]
  if (fotos > 0) {
    partes.push(`${fotos === 1 ? 'A foto' : `As ${fotos} fotos`} também será removida do Storage.`)
  }
  if (visitas > 0) {
    partes.push(
      visitas === 1
        ? 'Há 1 visita agendada para este imóvel. Ela continuará na agenda do corretor, identificada apenas pelo código.'
        : `Há ${visitas} visitas agendadas para este imóvel. Elas continuarão na agenda dos corretores, identificadas apenas pelo código.`,
    )
  }
  partes.push('O histórico fica registrado em logs_sistema.')
  return partes.join(' ')
}

function AlternadorVisualizacao({
  valor,
  aoMudar,
}: {
  valor: 'grade' | 'lista'
  aoMudar: (valor: 'grade' | 'lista') => void
}) {
  const opcoes = [
    { chave: 'grade' as const, icone: LayoutGrid, rotulo: 'Grade' },
    { chave: 'lista' as const, icone: List, rotulo: 'Lista' },
  ]

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-borda bg-superficie-alternativa p-1"
      role="group"
      aria-label="Visualização"
    >
      {opcoes.map(({ chave, icone: Icone, rotulo }) => (
        <button
          key={chave}
          type="button"
          onClick={() => aoMudar(chave)}
          aria-pressed={valor === chave}
          title={rotulo}
          className={cn(
            'flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors',
            valor === chave
              ? 'bg-superficie text-texto shadow-cartao'
              : 'text-texto-suave hover:text-texto',
          )}
        >
          <Icone className="size-4" />
          <span className="sr-only">{rotulo}</span>
        </button>
      ))}
    </div>
  )
}

