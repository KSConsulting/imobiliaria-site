import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'

interface Props {
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  /** Nome do item, exibido em destaque. Ex: "Casa no Jardim Europa". */
  nomeItem: string
  /** Ex: "imóvel", "corretor", "lead". Compõe a frase do modal. */
  tipoItem?: string
  /** Aviso extra sobre consequências. Ex: perda de fotos e histórico. */
  aviso?: string
  /**
   * Exige digitar um valor para liberar o botão.
   *
   * Reservado para exclusões irreversíveis — o caso do imóvel, cuja
   * exclusão é definitiva (ver CLAUDE.md, "Regras de negócio críticas").
   * Um clique errado ali não tem desfazer.
   */
  exigirDigitacao?: boolean
  /**
   * O que precisa ser digitado, quando difere do nome exibido.
   *
   * No imóvel, o nome exibido é o título e o que se digita é o código:
   * título é longo e às vezes ambíguo entre dois cadastros parecidos,
   * enquanto o código é curto, único e é como a equipe se refere ao
   * imóvel de qualquer forma.
   */
  valorConfirmacao?: string
  aoConfirmar: () => void | Promise<void>
}

/**
 * Modal de confirmação de exclusão.
 *
 * Usado em TODA exclusão do sistema, sem exceção — é convenção do
 * projeto. Nenhuma tela chama `delete` direto a partir de um clique.
 */
export function ModalConfirmacaoExclusao({
  aberto,
  aoMudarAberto,
  nomeItem,
  tipoItem = 'registro',
  aviso,
  exigirDigitacao = false,
  valorConfirmacao,
  aoConfirmar,
}: Props) {
  const [confirmacao, setConfirmacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const esperado = valorConfirmacao ?? nomeItem

  // Limpa o campo ao reabrir, senão a digitação anterior liberaria o
  // botão para o próximo item.
  useEffect(() => {
    if (aberto) setConfirmacao('')
  }, [aberto])

  const digitacaoConfere =
    !exigirDigitacao || confirmacao.trim().toLowerCase() === esperado.trim().toLowerCase()

  async function confirmar() {
    if (!digitacaoConfere || excluindo) return
    setExcluindo(true)
    try {
      await aoConfirmar()
      aoMudarAberto(false)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <AlertDialog open={aberto} onOpenChange={aoMudarAberto}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destrutivo/10">
              <AlertTriangle className="size-5 text-destrutivo" />
            </div>
            <div className="flex flex-col gap-2">
              <AlertDialogTitle>Excluir {tipoItem}?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a excluir{' '}
                <span className="font-semibold text-texto">{nomeItem}</span>. Esta ação não
                pode ser desfeita.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {aviso && (
          <p className="mt-4 rounded-lg border border-alerta/25 bg-alerta/8 px-3.5 py-3 text-sm text-texto-suave">
            {aviso}
          </p>
        )}

        {exigirDigitacao && (
          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor="confirmacao-exclusao">
              Digite <span className="font-semibold text-texto">{esperado}</span> para
              confirmar
            </Label>
            <Input
              id="confirmacao-exclusao"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={esperado}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variante="secundario"
            onClick={() => aoMudarAberto(false)}
            disabled={excluindo}
          >
            Cancelar
          </Button>
          <Button variante="destrutivo" onClick={confirmar} disabled={!digitacaoConfere || excluindo}>
            {excluindo && <Loader2 className="size-4 animate-spin" />}
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
