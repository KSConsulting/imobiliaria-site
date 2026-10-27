import { useCallback, useEffect, useState } from 'react'
import { GripVertical, Info, Pencil, Plus, Shapes, Trash2 } from 'lucide-react'
import { Alternador } from '@/componentes/ui/alternador'
import { Button } from '@/componentes/ui/button'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { ModalTipoImovel } from '@/componentes/configuracoes/ModalTipoImovel'
import {
  alternarTipo,
  ehTipoEmUso,
  excluirTipo,
  listarTipos,
  reordenarTipos,
  type TipoComUso,
} from '@/lib/tiposImovel'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

/**
 * Aba 2 — os tipos de imóvel.
 *
 * A lista alimenta três lugares: o cadastro de imóvel, os filtros da
 * vitrine e os chips da home. A ordem definida aqui é a ordem exibida lá
 * — daí o arrastar, que é a única forma de dizer "o que mais vendemos
 * vem primeiro" sem inventar um campo numérico para o usuário preencher.
 */
export function AbaTipos() {
  const [tipos, setTipos] = useState<TipoComUso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<TipoComUso | null>(null)
  const [paraExcluir, setParaExcluir] = useState<TipoComUso | null>(null)

  const [arrastado, setArrastado] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    try {
      setTipos(await listarTipos())
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os tipos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /* ----------------------------------------------------- reordenação -- */
  async function soltar(destino: number) {
    setAlvo(null)
    const origem = arrastado
    setArrastado(null)
    if (origem === null || origem === destino) return

    const reordenados = [...tipos]
    const [movido] = reordenados.splice(origem, 1)
    reordenados.splice(destino, 0, movido)

    // Atualização otimista: a lista se move sob o dedo. Esperar o banco
    // responder para só então mover faria o arrastar parecer travado.
    const anterior = tipos
    setTipos(reordenados)
    setSalvandoOrdem(true)

    try {
      await reordenarTipos(reordenados)
      await carregar()
    } catch (erro) {
      setTipos(anterior)
      notificar.erroDoBanco(erro, 'Não foi possível salvar a nova ordem.')
    } finally {
      setSalvandoOrdem(false)
    }
  }

  /* ----------------------------------------------------------- ações -- */
  async function alternar(tipo: TipoComUso) {
    try {
      await alternarTipo(tipo, !tipo.ativo)
      notificar.sucesso(
        tipo.ativo ? 'Tipo desativado' : 'Tipo reativado',
        tipo.ativo
          ? `"${tipo.nome}" sai dos cadastros novos e dos filtros do site. Os ${tipo.emUso} imóveis que já o usam continuam publicados.`
          : `"${tipo.nome}" volta a aparecer no cadastro de imóveis e nos filtros do site.`,
      )
      await carregar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível alterar o tipo.')
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirTipo(paraExcluir)
      notificar.sucesso('Tipo excluído', `"${paraExcluir.nome}" saiu da lista.`)
      setParaExcluir(null)
      await carregar()
    } catch (erro) {
      // O banco recusa por causa do ON DELETE RESTRICT em
      // imoveis.id_tipo_imovel. Sem o RESTRICT, apagar "Apartamento"
      // apagaria todos os apartamentos do estoque junto.
      if (ehTipoEmUso(erro)) {
        notificar.erro(
          `"${paraExcluir.nome}" não pode ser excluído`,
          `${paraExcluir.emUso} ${paraExcluir.emUso === 1 ? 'imóvel usa' : 'imóveis usam'} este tipo. Desative em vez de excluir: ele sai dos cadastros novos e dos filtros do site, e os imóveis existentes continuam funcionando.`,
        )
        setParaExcluir(null)
        return
      }
      notificar.erroDoBanco(erro, 'Não foi possível excluir o tipo.')
    }
  }

  if (carregando) return <EstadoCarregando mensagem="Carregando os tipos…" />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="texto-apoio max-w-2xl">
          Esta lista é livre e deve refletir o vocabulário da sua região: "chácara" no interior,
          "cobertura" na capital, "casa de praia" no litoral. É ela que aparece no cadastro de
          imóveis, nos filtros do site e nos atalhos da home.
        </p>

        <Button
          onClick={() => {
            setEmEdicao(null)
            setModalAberto(true)
          }}
        >
          <Plus className="size-4" />
          Novo tipo
        </Button>
      </div>

      {tipos.length === 0 ? (
        <div className="cartao">
          <EstadoVazio
            icone={Shapes}
            titulo="Nenhum tipo cadastrado"
            descricao="Sem ao menos um tipo, não é possível cadastrar imóvel: o tipo é obrigatório no cadastro."
            acao={{
              rotulo: 'Criar primeiro tipo',
              aoClicar: () => {
                setEmEdicao(null)
                setModalAberto(true)
              },
            }}
          />
        </div>
      ) : (
        <div className="cartao overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-borda bg-superficie-alternativa px-4 py-2.5 text-xs text-texto-suave sm:px-5">
            <Info className="size-3.5 shrink-0" />
            Arraste pela alça para mudar a ordem. É nesta ordem que os tipos aparecem nos filtros
            do site.
          </div>

          <ul className={cn('divide-y divide-borda', salvandoOrdem && 'opacity-70')}>
            {tipos.map((tipo, indice) => (
              <li
                key={tipo.id}
                draggable
                onDragStart={() => setArrastado(indice)}
                onDragEnd={() => {
                  setArrastado(null)
                  setAlvo(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setAlvo(indice)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void soltar(indice)
                }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors sm:px-5',
                  arrastado === indice && 'opacity-40',
                  alvo === indice && arrastado !== indice && 'bg-destaque-suave',
                )}
              >
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-texto-tenue active:cursor-grabbing"
                  aria-hidden
                />

                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      tipo.ativo ? 'text-texto' : 'text-texto-tenue line-through',
                    )}
                  >
                    {tipo.nome}
                  </span>
                  <span className="text-xs text-texto-suave">
                    {tipo.emUso === 0
                      ? 'Nenhum imóvel usa'
                      : `${tipo.emUso} ${tipo.emUso === 1 ? 'imóvel usa' : 'imóveis usam'}`}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <Alternador
                    marcado={tipo.ativo}
                    aoMudar={() => void alternar(tipo)}
                    className="mr-1"
                  />

                  <Button
                    variante="fantasma"
                    tamanho="iconePequeno"
                    title="Renomear"
                    aria-label={`Renomear ${tipo.nome}`}
                    onClick={() => {
                      setEmEdicao(tipo)
                      setModalAberto(true)
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>

                  <Button
                    variante="fantasma"
                    tamanho="iconePequeno"
                    title={tipo.emUso > 0 ? 'Tipo em uso. Desative em vez de excluir' : 'Excluir'}
                    aria-label={`Excluir ${tipo.nome}`}
                    onClick={() => setParaExcluir(tipo)}
                  >
                    <Trash2 className="size-4 text-destrutivo" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ModalTipoImovel
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        tipo={emEdicao}
        nomesExistentes={tipos.filter((t) => t.id !== emEdicao?.id).map((t) => t.nome)}
        aoSalvar={carregar}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="tipo de imóvel"
          nomeItem={paraExcluir.nome}
          aviso={
            paraExcluir.emUso > 0
              ? `${paraExcluir.emUso} ${paraExcluir.emUso === 1 ? 'imóvel usa' : 'imóveis usam'} este tipo, e o banco vai recusar a exclusão. Use o interruptor para desativar: o tipo some dos cadastros novos e dos filtros do site, e os imóveis existentes continuam publicados.`
              : 'Nenhum imóvel usa este tipo, então a exclusão é segura.'
          }
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}
