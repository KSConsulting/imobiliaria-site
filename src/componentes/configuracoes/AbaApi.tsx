import { useCallback, useEffect, useState } from 'react'
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { EstadoVazio } from '@/componentes/EstadoVazio'
import { ModalConfirmacaoExclusao } from '@/componentes/ModalConfirmacaoExclusao'
import { ModalNovoToken } from '@/componentes/configuracoes/ModalNovoToken'
import { DocumentacaoApi } from '@/componentes/configuracoes/DocumentacaoApi'
import {
  alternarToken,
  copiar,
  excluirToken,
  listarTokens,
  mascararToken,
  type TokenApi,
} from '@/lib/tokens'
import { formatarDataHora, tempoRelativo } from '@/lib/datas'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

/**
 * Aba 3 — os tokens da API pública e a documentação dos endpoints.
 *
 * Os tokens vieram na Etapa 8, antes da API, de propósito: é com um
 * deles na mão que a integração do N8N é montada. A documentação abaixo
 * usa o token escolhido na lista para preencher os exemplos, de forma
 * que copiar e colar seja suficiente — sem edição manual de credencial,
 * que é onde nascem os erros de digitação.
 */
export function AbaApi({ fuso }: { fuso: string }) {
  const [tokens, setTokens] = useState<TokenApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [paraAlternar, setParaAlternar] = useState<TokenApi | null>(null)
  const [paraExcluir, setParaExcluir] = useState<TokenApi | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [alternando, setAlternando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setTokens(await listarTokens())
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível carregar os tokens.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function copiarToken(token: TokenApi) {
    const ok = await copiar(token.token)
    if (!ok) {
      notificar.aviso('Não consegui copiar', 'O navegador bloqueou o acesso à área de transferência.')
      return
    }
    setCopiadoId(token.id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  async function confirmarAlternar() {
    if (!paraAlternar) return
    setAlternando(true)
    try {
      await alternarToken(paraAlternar, !paraAlternar.ativo)
      notificar.sucesso(
        paraAlternar.ativo ? 'Token revogado' : 'Token reativado',
        paraAlternar.ativo
          ? `"${paraAlternar.nome}" deixa de funcionar a partir da próxima chamada.`
          : `"${paraAlternar.nome}" volta a ser aceito pela API.`,
      )
      setParaAlternar(null)
      await carregar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível alterar o token.')
    } finally {
      setAlternando(false)
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return
    try {
      await excluirToken(paraExcluir)
      notificar.sucesso('Token excluído', `"${paraExcluir.nome}" saiu da lista.`)
      setParaExcluir(null)
      await carregar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível excluir o token.')
    }
  }

  if (carregando) return <EstadoCarregando mensagem="Carregando os tokens…" />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="texto-apoio max-w-2xl">
          Cada integração que consome a API usa um token próprio. Um por consumidor, porque é
          isso que permite revogar o do portal sem derrubar o agente de IA junto — e saber, pelos
          logs, qual dos dois fez o quê.
        </p>

        <Button onClick={() => setModalAberto(true)}>
          <Plus className="size-4" />
          Novo token
        </Button>
      </div>

      {tokens.length === 0 ? (
        <div className="cartao">
          <EstadoVazio
            icone={KeyRound}
            titulo="Nenhum token criado"
            descricao="O agente de IA no WhatsApp precisa de um token para consultar imóveis, criar leads e marcar visitas. Crie o primeiro antes de montar a automação."
            acao={{ rotulo: 'Criar primeiro token', aoClicar: () => setModalAberto(true) }}
          />
        </div>
      ) : (
        <div className="cartao overflow-hidden p-0">
          <ul className="divide-y divide-borda">
            {tokens.map((token) => (
              <li
                key={token.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5',
                  !token.ativo && 'bg-superficie-alternativa/60',
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        token.ativo ? 'text-texto' : 'text-texto-tenue',
                      )}
                    >
                      {token.nome}
                    </span>
                    <Badge variante={token.ativo ? 'suave' : 'inativo'}>
                      {token.ativo ? 'Ativo' : 'Revogado'}
                    </Badge>
                  </div>

                  <code className="font-mono text-xs text-texto-suave">
                    {mascararToken(token.token)}
                  </code>

                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-texto-tenue">
                    <span>Criado em {formatarDataHora(new Date(token.created_at), fuso)}</span>
                    <span>
                      {token.ultimo_uso
                        ? `Último uso ${tempoRelativo(token.ultimo_uso)}`
                        : 'Nunca usado'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <Button
                    variante="fantasma"
                    tamanho="pequeno"
                    onClick={() => void copiarToken(token)}
                    title="Copiar o valor completo"
                  >
                    {copiadoId === token.id ? (
                      <Check className="size-4 text-sucesso" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copiadoId === token.id ? 'Copiado' : 'Copiar'}
                  </Button>

                  <Button
                    variante="fantasma"
                    tamanho="iconePequeno"
                    onClick={() => setParaAlternar(token)}
                    title={token.ativo ? 'Revogar' : 'Reativar'}
                    aria-label={token.ativo ? `Revogar ${token.nome}` : `Reativar ${token.nome}`}
                  >
                    {token.ativo ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
                  </Button>

                  <Button
                    variante="fantasma"
                    tamanho="iconePequeno"
                    onClick={() => setParaExcluir(token)}
                    title="Excluir"
                    aria-label={`Excluir ${token.nome}`}
                  >
                    <Trash2 className="size-4 text-destrutivo" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DocumentacaoApi tokens={tokens} />

      <ModalNovoToken
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        aoCriar={carregar}
      />

      {paraAlternar && (
        <AlertDialog open onOpenChange={(aberto) => !aberto && setParaAlternar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destaque-suave">
                  {paraAlternar.ativo ? (
                    <Ban className="size-5 text-destaque" />
                  ) : (
                    <RotateCcw className="size-5 text-destaque" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <AlertDialogTitle>
                    {paraAlternar.ativo ? 'Revogar este token?' : 'Reativar este token?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {paraAlternar.ativo ? (
                      <>
                        Qualquer integração usando <strong>{paraAlternar.nome}</strong> para de
                        funcionar <strong>imediatamente</strong> — não há período de tolerância. Se
                        for o token do agente de IA, o WhatsApp deixa de responder sobre imóveis
                        até alguém trocar o valor na automação.
                        <br />
                        <br />
                        A revogação é reversível: a linha continua aqui e pode ser reativada.
                      </>
                    ) : (
                      <>
                        <strong>{paraAlternar.nome}</strong> volta a ser aceito pela API com o
                        mesmo valor de antes. Se ele foi revogado por suspeita de vazamento, crie
                        um token novo em vez de reativar este.
                      </>
                    )}
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <Button
                variante="secundario"
                onClick={() => setParaAlternar(null)}
                disabled={alternando}
              >
                Cancelar
              </Button>
              <Button onClick={() => void confirmarAlternar()} disabled={alternando}>
                {alternando && <Loader2 className="size-4 animate-spin" />}
                {paraAlternar.ativo ? 'Revogar' : 'Reativar'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {paraExcluir && (
        <ModalConfirmacaoExclusao
          aberto
          aoMudarAberto={(aberto) => !aberto && setParaExcluir(null)}
          tipoItem="token"
          nomeItem={paraExcluir.nome}
          aviso="Excluir apaga também quando ele foi criado e quando foi usado pela última vez. Se a intenção é só tirar de circulação, revogue: a integração para do mesmo jeito e o histórico fica."
          aoConfirmar={confirmarExclusao}
        />
      )}
    </div>
  )
}
