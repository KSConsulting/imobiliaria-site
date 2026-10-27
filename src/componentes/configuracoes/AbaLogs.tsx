import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, ScrollText, Search, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Select } from '@/componentes/ui/select'
import { EsqueletoTabela } from '@/componentes/EstadoCarregando'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { PainelLog } from '@/componentes/configuracoes/PainelLog'
import {
  autorDoLog,
  buscarOpcoesFiltro,
  CATEGORIAS_LOG,
  descreverAcao,
  FILTROS_VAZIOS,
  listarLogs,
  rotuloCategoria,
  rotuloTabela,
  TAMANHO_PAGINA_LOGS,
  type FiltrosLog,
  type LinhaLog,
  type OpcoesFiltroLog,
} from '@/lib/auditoria'
import { formatarDataHora } from '@/lib/datas'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

/**
 * Aba 4 — a trilha de auditoria.
 *
 * **Somente leitura, e isso é estrutural.** `logs_sistema` tem política
 * de select e de insert e nenhuma de update ou delete: mesmo que alguém
 * escrevesse o botão, o banco recusaria. Log que pode ser editado não é
 * log — e esta tela é a única rastreabilidade que sobra depois que um
 * imóvel é excluído, já que a exclusão é definitiva.
 */
export function AbaLogs({ fuso }: { fuso: string }) {
  const [filtros, setFiltros] = useState<FiltrosLog>(FILTROS_VAZIOS)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const [linhas, setLinhas] = useState<LinhaLog[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [opcoes, setOpcoes] = useState<OpcoesFiltroLog>({
    tabelas: [],
    categorias: [],
    usuarios: [],
  })

  const [aberto, setAberto] = useState<LinhaLog | null>(null)

  // A busca só vai ao banco depois que a digitação para. Cada tecla
  // dispararia uma varredura sobre o jsonb dos logs, que é justamente a
  // consulta mais cara desta tela.
  //
  // A montagem é pulada: sem isso o efeito devolveria a paginação para a
  // primeira página 350 ms depois de a tela abrir, desfazendo um clique
  // em "Próxima" dado nesse intervalo.
  const primeiraBusca = useRef(true)
  useEffect(() => {
    if (primeiraBusca.current) {
      primeiraBusca.current = false
      return
    }
    const id = setTimeout(() => {
      setFiltros((atuais) => ({ ...atuais, busca }))
      setPagina(0)
    }, 350)
    return () => clearTimeout(id)
  }, [busca])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const pagina_ = await listarLogs(filtros, pagina, fuso)
      setLinhas(pagina_.linhas)
      setTotal(pagina_.total)
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os registros.')
      setLinhas([])
      setTotal(0)
    } finally {
      setCarregando(false)
    }
  }, [filtros, pagina, fuso])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    buscarOpcoesFiltro()
      .then(setOpcoes)
      .catch(() => {
        // Sem as opções a tela continua utilizável: os seletores ficam
        // vazios, a lista e a busca não dependem deles.
      })
  }, [])

  function definir<C extends keyof FiltrosLog>(campo: C, valor: string) {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }))
    setPagina(0)
  }

  const temFiltro =
    Boolean(busca) ||
    Boolean(filtros.categoria) ||
    Boolean(filtros.tabela) ||
    Boolean(filtros.usuario) ||
    Boolean(filtros.de) ||
    Boolean(filtros.ate)

  function limpar() {
    setBusca('')
    setFiltros(FILTROS_VAZIOS)
    setPagina(0)
  }

  const ultimaPagina = Math.max(0, Math.ceil(total / TAMANHO_PAGINA_LOGS) - 1)
  const primeiroDaPagina = pagina * TAMANHO_PAGINA_LOGS + 1
  const ultimoDaPagina = Math.min(total, (pagina + 1) * TAMANHO_PAGINA_LOGS)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="texto-apoio max-w-2xl">
          Tudo o que foi feito no sistema, do mais recente para o mais antigo. É onde se descobre
          quem alterou o valor de um imóvel, e o que havia num imóvel que já foi excluído.
        </p>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-superficie-alternativa px-3 py-1.5 text-xs font-medium text-texto-suave">
          <ShieldCheck className="size-3.5" />
          Somente leitura
        </span>
      </div>

      {/* ------------------------------------------------------ filtros -- */}
      <div className="cartao flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-tenue" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, nome, telefone…"
            className="pl-9"
            aria-label="Buscar nos registros"
          />
        </div>
        <p className="-mt-2 text-xs text-texto-tenue">
          A busca entra no conteúdo do registro, não só no título. Procurar por{' '}
          <code className="rounded bg-superficie-alternativa px-1 py-0.5 font-mono">IMV-0042</code>{' '}
          encontra o imóvel mesmo depois de ele ter sido excluído.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filtros.categoria}
            onChange={(e) => definir('categoria', e.target.value)}
            aria-label="Tipo de ação"
          >
            <option value="">Todos os tipos de ação</option>
            {opcoes.categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {rotuloCategoria(categoria)}
              </option>
            ))}
          </Select>

          <Select
            value={filtros.tabela}
            onChange={(e) => definir('tabela', e.target.value)}
            aria-label="Tabela afetada"
          >
            <option value="">Todas as áreas</option>
            {opcoes.tabelas.map((tabela) => (
              <option key={tabela} value={tabela}>
                {rotuloTabela(tabela)}
              </option>
            ))}
          </Select>

          <Select
            value={filtros.usuario}
            onChange={(e) => definir('usuario', e.target.value)}
            aria-label="Usuário"
          >
            <option value="">Todos os usuários</option>
            {opcoes.usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nome}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filtros.de}
              onChange={(e) => definir('de', e.target.value)}
              aria-label="Data inicial"
            />
            <span className="text-xs text-texto-tenue">até</span>
            <Input
              type="date"
              value={filtros.ate}
              onChange={(e) => definir('ate', e.target.value)}
              aria-label="Data final"
            />
          </div>
        </div>

        {temFiltro && (
          <div className="flex items-center justify-between gap-3 border-t border-borda pt-3">
            <p className="text-xs text-texto-suave">
              {total === 0
                ? 'Nenhum registro com esses filtros'
                : `${total} ${total === 1 ? 'registro encontrado' : 'registros encontrados'}`}
            </p>
            <Button variante="fantasma" tamanho="pequeno" onClick={limpar}>
              <X className="size-4" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- lista -- */}
      {carregando ? (
        <div className="cartao">
          <EsqueletoTabela linhas={8} colunas={4} />
        </div>
      ) : linhas.length === 0 ? (
        <div className="cartao">
          <EstadoVazio
            icone={ScrollText}
            titulo={temFiltro ? 'Nenhum registro com esses filtros' : 'Nenhuma ação registrada'}
            descricao={
              temFiltro
                ? 'Tente ampliar o período ou remover um dos filtros.'
                : 'A trilha se preenche sozinha conforme o sistema for usado. Cadastre um imóvel ou um corretor e o primeiro registro aparece aqui.'
            }
            acao={temFiltro ? { rotulo: 'Limpar filtros', aoClicar: limpar } : undefined}
          />
        </div>
      ) : (
        <div className="cartao overflow-hidden p-0">
          {/* Desktop: tabela. Mobile: a mesma informação empilhada — uma
              tabela de cinco colunas em 375px vira rolagem horizontal
              sobre texto, que ninguém lê. */}
          <table className="hidden w-full text-left md:table">
            <thead>
              <tr className="border-b border-borda bg-superficie-alternativa text-xs font-semibold tracking-wide text-texto-suave uppercase">
                <th className="px-5 py-3">Quando</th>
                <th className="px-5 py-3">Quem</th>
                <th className="px-5 py-3">O que fez</th>
                <th className="px-5 py-3">Área</th>
                <th className="px-5 py-3 text-right">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {linhas.map((log) => {
                const categoria = CATEGORIAS_LOG[log.categoria] ?? CATEGORIAS_LOG.outro
                return (
                  <tr key={log.id} className="hover:bg-superficie-alternativa/60">
                    <td className="px-5 py-3.5 text-sm whitespace-nowrap text-texto-suave">
                      {formatarDataHora(new Date(log.created_at), fuso)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-texto-suave">
                      <Autor log={log} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-texto">
                          {descreverAcao(log)}
                        </span>
                        <span
                          className={cn(
                            'w-fit rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                            categoria.classe,
                          )}
                        >
                          {categoria.rotulo}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-texto-suave">
                      {rotuloTabela(log.tabela)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variante="fantasma"
                        tamanho="iconePequeno"
                        onClick={() => setAberto(log)}
                        aria-label="Ver detalhe do registro"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <ul className="divide-y divide-borda md:hidden">
            {linhas.map((log) => {
              const categoria = CATEGORIAS_LOG[log.categoria] ?? CATEGORIAS_LOG.outro
              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => setAberto(log)}
                    className="flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3.5 text-left"
                  >
                    <span className="text-sm font-medium text-texto">{descreverAcao(log)}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                          categoria.classe,
                        )}
                      >
                        {categoria.rotulo}
                      </span>
                      <Autor log={log} /> · {formatarDataHora(new Date(log.created_at), fuso)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------- paginação -- */}
      {total > TAMANHO_PAGINA_LOGS && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-texto-suave">
            {primeiroDaPagina}–{ultimoDaPagina} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variante="secundario"
              tamanho="pequeno"
              disabled={pagina === 0 || carregando}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variante="secundario"
              tamanho="pequeno"
              disabled={pagina >= ultimaPagina || carregando}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <PainelLog log={aberto} aoFechar={() => setAberto(null)} fuso={fuso} />
    </div>
  )
}

/**
 * Quem fez a ação.
 *
 * O selo "via API" é o que separa, de relance, o que a equipe fez do que
 * o agente de IA fez — a distinção que mais importa quando o volume da
 * trilha passa a ser majoritariamente dele.
 */
function Autor({ log }: { log: LinhaLog }) {
  const { nome, viaApi } = autorDoLog(log)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {nome}
      {viaApi && (
        <span className="rounded-full border border-borda bg-superficie-alternativa px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-texto-tenue uppercase">
          via API
        </span>
      )}
    </span>
  )
}
