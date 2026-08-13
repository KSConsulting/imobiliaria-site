import { useState } from 'react'
import { ArrowRight, FileX2, User, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/componentes/ui/sheet'
import { Button } from '@/componentes/ui/button'
import {
  autorDoLog,
  CATEGORIAS_LOG,
  compararEstados,
  contarAlteracoes,
  descreverAcao,
  formatarValorCampo,
  rotuloTabela,
  type LinhaLog,
} from '@/lib/auditoria'
import { formatarDataHora } from '@/lib/datas'
import { cn } from '@/lib/utils'

/**
 * Detalhe de um registro da trilha.
 *
 * Painel lateral e não página, pela mesma razão da ficha do lead: o uso
 * real é conferir vários registros em sequência, e navegar para uma
 * página a cada um perderia a lista, a rolagem e o filtro toda vez.
 */
export function PainelLog({
  log,
  aoFechar,
  fuso,
}: {
  log: LinhaLog | null
  aoFechar: () => void
  fuso: string
}) {
  const [mostrarTodos, setMostrarTodos] = useState(false)

  return (
    <Sheet
      open={Boolean(log)}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setMostrarTodos(false)
          aoFechar()
        }
      }}
    >
      <SheetContent lado="direita" className="w-full p-0 sm:max-w-xl">
        {log && <Conteudo log={log} fuso={fuso} mostrarTodos={mostrarTodos} aoAlternarTodos={setMostrarTodos} aoFechar={aoFechar} />}
      </SheetContent>
    </Sheet>
  )
}

function Conteudo({
  log,
  fuso,
  mostrarTodos,
  aoAlternarTodos,
  aoFechar,
}: {
  log: LinhaLog
  fuso: string
  mostrarTodos: boolean
  aoAlternarTodos: (valor: boolean) => void
  aoFechar: () => void
}) {
  const categoria = CATEGORIAS_LOG[log.categoria] ?? CATEGORIAS_LOG.outro
  const autor = autorDoLog(log)
  const diferencas = compararEstados(log.dados_anteriores, log.dados_novos)
  const alteracoes = contarAlteracoes(diferencas)

  const temAnterior = Boolean(log.dados_anteriores)
  const temNovo = Boolean(log.dados_novos)
  const ehExclusao = temAnterior && !temNovo
  const ehCriacao = !temAnterior && temNovo
  const ehEdicao = temAnterior && temNovo

  // Numa edição de imóvel são quarenta campos e às vezes um mudou.
  // Listar todos por padrão enterra justamente o que se veio procurar.
  const visiveis = ehEdicao && !mostrarTodos ? diferencas.filter((d) => d.mudou) : diferencas

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-borda px-5 py-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                categoria.classe,
              )}
            >
              {categoria.rotulo}
            </span>
            <span className="text-xs text-texto-tenue">{rotuloTabela(log.tabela)}</span>
          </div>

          <SheetTitle className="text-base leading-snug font-semibold text-texto">
            {descreverAcao(log)}
          </SheetTitle>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {autor.nome}
              {autor.viaApi && <span className="text-texto-tenue">· via API</span>}
            </span>
            <span>{formatarDataHora(new Date(log.created_at), fuso)}</span>
          </div>
        </div>

        <Button variante="fantasma" tamanho="iconePequeno" onClick={aoFechar} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {ehExclusao && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-destrutivo/30 bg-destrutivo/5 px-4 py-3.5">
            <FileX2 className="mt-0.5 size-4.5 shrink-0 text-destrutivo" />
            <p className="text-xs leading-relaxed text-texto-suave">
              Este registro não existe mais no banco.{' '}
              <strong className="text-texto">O que está abaixo é tudo o que restou dele</strong> —
              a exclusão de imóvel é definitiva e não há para onde voltar atrás.
            </p>
          </div>
        )}

        {ehEdicao && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-texto-suave">
              {alteracoes === 0
                ? 'Nenhum campo mudou de valor.'
                : `${alteracoes} ${alteracoes === 1 ? 'campo alterado' : 'campos alterados'}.`}
            </p>
            <button
              type="button"
              onClick={() => aoAlternarTodos(!mostrarTodos)}
              className="cursor-pointer text-xs font-medium text-destaque hover:underline"
            >
              {mostrarTodos ? 'Ver só o que mudou' : `Ver todos os ${diferencas.length} campos`}
            </button>
          </div>
        )}

        {visiveis.length === 0 ? (
          <p className="rounded-xl border border-borda bg-superficie-alternativa px-4 py-6 text-center text-sm text-texto-suave">
            {diferencas.length === 0
              ? 'Esta ação não guardou dados — é o caso de entradas e saídas do sistema.'
              : 'Nenhum campo mudou de valor nesta gravação.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visiveis.map((diferenca) => (
              <li
                key={diferenca.campo}
                className={cn(
                  'rounded-xl border px-4 py-3',
                  diferenca.mudou && ehEdicao
                    ? 'border-destaque/35 bg-destaque-suave/35'
                    : 'border-borda bg-superficie',
                )}
              >
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                  {diferenca.rotulo}
                </p>

                {ehCriacao || ehExclusao ? (
                  <p className="text-sm break-words text-texto">
                    {formatarValorCampo(
                      diferenca.campo,
                      ehCriacao ? diferenca.depois : diferenca.antes,
                    )}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                    <p className="min-w-0 flex-1 text-sm break-words text-texto-suave line-through decoration-texto-tenue/50">
                      {formatarValorCampo(diferenca.campo, diferenca.antes)}
                    </p>
                    <ArrowRight className="hidden size-4 shrink-0 self-center text-texto-tenue sm:block" />
                    <p className="min-w-0 flex-1 text-sm font-medium break-words text-texto">
                      {formatarValorCampo(diferenca.campo, diferenca.depois)}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {log.id_registro && (
          <p className="mt-5 text-xs break-all text-texto-tenue">
            Identificador do registro: <code className="font-mono">{log.id_registro}</code>
          </p>
        )}
      </div>
    </div>
  )
}
