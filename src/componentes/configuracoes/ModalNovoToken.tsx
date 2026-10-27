import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Campo } from '@/componentes/SecaoFormulario'
import { copiar, criarToken, type TokenApi } from '@/lib/tokens'
import { notificar } from '@/lib/notificacoes'

interface Props {
  aberto: boolean
  aoFechar: () => void
  aoCriar: () => Promise<void>
}

/**
 * Criação de token, em duas etapas dentro do mesmo modal.
 *
 * A segunda etapa — exibir o valor gerado — existe porque este é o
 * momento em que o token precisa sair daqui e ir para o N8N. Fechar o
 * modal e mandar procurar na lista transforma uma ação de dez segundos
 * em duas telas e uma dúvida.
 */
export function ModalNovoToken({ aberto, aoFechar, aoCriar }: Props) {
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [criando, setCriando] = useState(false)
  const [criado, setCriado] = useState<TokenApi | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (aberto) return
    // Limpa ao fechar, não ao abrir: limpar na abertura faria o valor
    // recém-criado sumir da tela no instante em que ele aparece.
    setNome('')
    setErro(undefined)
    setCriado(null)
    setCopiado(false)
  }, [aberto])

  async function criar() {
    const limpo = nome.trim()
    if (!limpo) {
      setErro('Dê um nome que identifique quem vai usar este token.')
      return
    }

    setCriando(true)
    try {
      setCriado(await criarToken(limpo))
      await aoCriar()
    } catch (erroCriar) {
      notificar.erroDoBanco(erroCriar, 'Não foi possível criar o token.')
    } finally {
      setCriando(false)
    }
  }

  async function copiarValor() {
    if (!criado) return
    const ok = await copiar(criado.token)
    if (!ok) {
      notificar.aviso('Não consegui copiar', 'Selecione o texto e copie manualmente.')
      return
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !criando && aoFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{criado ? 'Token criado' : 'Novo token da API'}</DialogTitle>
          <DialogDescription>
            {criado
              ? 'Copie o valor abaixo e cole na integração que vai consumir a API.'
              : 'Um token por consumidor. Assim, revogar o do portal não derruba o agente de IA junto.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {criado ? (
            <>
              <div className="flex flex-col gap-2 rounded-xl border border-borda bg-superficie-alternativa p-4">
                <span className="text-xs font-medium text-texto-suave">{criado.nome}</span>
                <code className="break-all font-mono text-sm text-texto">{criado.token}</code>
              </div>

              <Button type="button" variante="secundario" onClick={() => void copiarValor()}>
                {copiado ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
                {copiado ? 'Copiado' : 'Copiar token'}
              </Button>

              <p className="flex items-start gap-2 rounded-lg border border-borda px-3.5 py-2.5 text-xs leading-relaxed text-texto-suave">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
                <span>
                  Trate como senha: quem tem este valor fala com a API como se fosse a
                  imobiliária. Se ele vazar, revogue aqui mesmo: a revogação vale na chamada
                  seguinte, sem esperar nada expirar.
                </span>
              </p>
            </>
          ) : (
            <Campo
              id="nome-token"
              rotulo="Quem vai usar este token"
              obrigatorio
              erro={erro}
              dica="É o nome que aparece na lista e nos logs. Escolha algo que identifique a integração, não a pessoa."
            >
              <Input
                id="nome-token"
                value={nome}
                autoFocus
                onChange={(e) => {
                  setNome(e.target.value)
                  setErro(undefined)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void criar()
                }}
                placeholder="Agente WhatsApp"
              />
            </Campo>
          )}
        </DialogBody>

        <DialogFooter>
          {criado ? (
            <Button onClick={aoFechar}>Concluir</Button>
          ) : (
            <>
              <Button variante="secundario" onClick={aoFechar} disabled={criando}>
                Cancelar
              </Button>
              <Button onClick={() => void criar()} disabled={criando}>
                {criando ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Gerar token
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
