import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Plus } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { CartaoCorretor } from '@/componentes/corretores/CartaoCorretor'
import { ModalCorretor } from '@/componentes/corretores/ModalCorretor'
import { ModalDesativarCorretor } from '@/componentes/corretores/ModalDesativarCorretor'
import {
  alterarStatusCorretor,
  contarVisitasDoCorretor,
  ehErroDeVinculo,
  excluirCorretor,
  listarCorretores,
  type CorretorCompleto,
} from '@/lib/corretores'
import { notificar } from '@/lib/notificacoes'

export function Corretores() {
  const [corretores, setCorretores] = useState<CorretorCompleto[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<CorretorCompleto | null>(null)
  const [paraAlternar, setParaAlternar] = useState<CorretorCompleto | null>(null)
  const [paraExcluir, setParaExcluir] = useState<CorretorCompleto | null>(null)
  const [visitasDoExcluir, setVisitasDoExcluir] = useState(0)

  const carregar = useCallback(async () => {
    try {
      setCorretores(await listarCorretores())
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os corretores.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  function abrirNovo() {
    setEmEdicao(null)
    setModalAberto(true)
  }

  function abrirEdicao(corretor: CorretorCompleto) {
    setEmEdicao(corretor)
    setModalAberto(true)
  }

  async function confirmarAlternarStatus(corretor: CorretorCompleto) {
    try {
      await alterarStatusCorretor(corretor, !corretor.ativo)
      notificar.sucesso(
        corretor.ativo ? 'Corretor desativado' : 'Corretor reativado',
        corretor.ativo
          ? `${corretor.nome} deixa de receber novas visitas. O histórico dele permanece.`
          : `${corretor.nome} volta a receber visitas e a ter horários oferecidos pela API.`,
      )
      setParaAlternar(null)
      await carregar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível alterar o status.')
    }
  }

  async function abrirExclusao(corretor: CorretorCompleto) {
    setParaExcluir(corretor)
    setVisitasDoExcluir(await contarVisitasDoCorretor(corretor.id))
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirCorretor(paraExcluir)
      notificar.sucesso('Corretor excluído', `${paraExcluir.nome} ${paraExcluir.sobrenome}`)
      setParaExcluir(null)
      await carregar()
    } catch (erro) {
      // O banco recusa por causa do ON DELETE RESTRICT em
      // agendamentos.id_corretor. A mensagem crua não ajudaria ninguém.
      if (ehErroDeVinculo(erro)) {
        notificar.erro(
          'Este corretor não pode ser excluído',
          'Ele tem visitas no histórico, e apagá-lo deixaria esses compromissos sem responsável. Desative em vez de excluir: ele para de receber novas visitas e o histórico fica preservado.',
        )
        setParaExcluir(null)
        return
      }
      notificar.erroDoBanco(erro, 'Não foi possível excluir o corretor.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Corretores</h2>
          <p className="texto-apoio max-w-2xl">
            A equipe que conduz as visitas. Cada corretor tem cor própria na agenda e janela de
            atendimento independente. É ela que a API oferece ao agente de IA.
          </p>
        </div>

        <Button onClick={abrirNovo}>
          <Plus className="size-4" />
          Novo corretor
        </Button>
      </div>

      {carregando ? (
        <EstadoCarregando mensagem="Carregando os corretores…" />
      ) : corretores.length === 0 ? (
        <div className="cartao">
          <EstadoVazio
            icone={BadgeCheck}
            titulo="Nenhum corretor cadastrado"
            descricao="A agenda depende de corretores: sem ninguém cadastrado, não há horário para oferecer e nenhuma visita pode ser marcada. Ao salvar o primeiro, o banco já cria a agenda dele com a janela padrão de segunda a sexta, das 9h às 18h."
            acao={{ rotulo: 'Cadastrar primeiro corretor', aoClicar: abrirNovo }}
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {corretores.map((corretor) => (
            <CartaoCorretor
              key={corretor.id}
              corretor={corretor}
              aoEditar={abrirEdicao}
              aoAlternarStatus={setParaAlternar}
              aoExcluir={(c) => void abrirExclusao(c)}
            />
          ))}
        </div>
      )}

      <ModalCorretor
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        corretor={emEdicao}
        todos={corretores}
        aoSalvar={carregar}
      />

      <ModalDesativarCorretor
        corretor={paraAlternar}
        aoFechar={() => setParaAlternar(null)}
        aoConfirmar={confirmarAlternarStatus}
      />

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="corretor"
          nomeItem={`${paraExcluir.nome} ${paraExcluir.sobrenome}`}
          aviso={
            visitasDoExcluir > 0
              ? `Este corretor tem ${visitasDoExcluir} ${
                  visitasDoExcluir === 1 ? 'visita' : 'visitas'
                } no histórico. O banco vai recusar a exclusão: visita sem responsável é um compromisso que ninguém sabe de quem era. Use "Desativar" no lugar.`
              : 'A agenda e a janela de atendimento deste corretor serão removidas junto.'
          }
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}
