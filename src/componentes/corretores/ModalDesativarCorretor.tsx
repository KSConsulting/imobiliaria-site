import { useState } from 'react'
import { Loader2, Power, UserMinus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import type { CorretorCompleto } from '@/lib/corretores'

/**
 * Confirmação de desativar ou reativar corretor.
 *
 * Como no imóvel, desativar é reversível e não usa cor destrutiva. A
 * frase precisa dizer as três consequências que importam: para de
 * receber visitas novas, some das opções da API, e o histórico fica.
 */
export function ModalDesativarCorretor({
  corretor,
  aoFechar,
  aoConfirmar,
}: {
  corretor: CorretorCompleto | null
  aoFechar: () => void
  aoConfirmar: (corretor: CorretorCompleto) => Promise<void>
}) {
  const [salvando, setSalvando] = useState(false)
  if (!corretor) return null

  const desativando = corretor.ativo
  const nome = `${corretor.nome} ${corretor.sobrenome}`

  async function confirmar() {
    if (!corretor) return
    setSalvando(true)
    try {
      await aoConfirmar(corretor)
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
                <UserMinus className="size-5 text-destaque" />
              ) : (
                <Power className="size-5 text-destaque" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <AlertDialogTitle>
                {desativando ? 'Desativar corretor?' : 'Reativar corretor?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {desativando ? (
                  <>
                    <span className="font-semibold text-texto">{nome}</span> deixa de aparecer
                    como opção em novas visitas e a API para de oferecer os horários dele ao
                    agente de IA.{' '}
                    {corretor.visitasProximas > 0 && (
                      <>
                        As{' '}
                        <span className="font-semibold text-texto">
                          {corretor.visitasProximas}
                        </span>{' '}
                        visitas já agendadas continuam na agenda.{' '}
                      </>
                    )}
                    Todo o histórico é preservado e você pode reativar quando quiser.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-texto">{nome}</span> volta a receber
                    visitas e a ter os horários da janela dele oferecidos pela API.
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
