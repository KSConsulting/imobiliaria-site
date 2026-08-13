import { useState } from 'react'
import { EyeOff, Loader2, Power } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import type { ImovelComRelacoes } from '@/lib/imoveis'

/**
 * Confirmação de desativar ou reativar.
 *
 * Deliberadamente diferente do modal de exclusão: sem cor destrutiva,
 * sem digitação, e com uma frase que diz exatamente o que muda. A
 * distinção entre desativar e excluir é a regra de negócio mais
 * importante da tela, e ela precisa estar evidente para o usuário, não
 * apenas correta no código.
 */
export function ModalDesativacao({
  imovel,
  aoFechar,
  aoConfirmar,
}: {
  imovel: ImovelComRelacoes | null
  aoFechar: () => void
  aoConfirmar: (imovel: ImovelComRelacoes) => Promise<void>
}) {
  const [salvando, setSalvando] = useState(false)
  if (!imovel) return null

  const desativando = imovel.status === 'ativo'

  async function confirmar() {
    if (!imovel) return
    setSalvando(true)
    try {
      await aoConfirmar(imovel)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destaque-suave">
              {desativando ? (
                <EyeOff className="size-5 text-destaque" />
              ) : (
                <Power className="size-5 text-destaque" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <AlertDialogTitle>
                {desativando ? 'Desativar imóvel?' : 'Reativar imóvel?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {desativando ? (
                  <>
                    <span className="font-semibold text-texto">{imovel.codigo}</span> sai da
                    vitrine e das consultas de disponíveis da API, mas o cadastro, as fotos e
                    os contadores permanecem aqui, intactos. Você pode reativar quando quiser.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-texto">{imovel.codigo}</span> volta a
                    aparecer no site público e nas consultas da API imediatamente.
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {desativando ? 'Desativar' : 'Reativar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
