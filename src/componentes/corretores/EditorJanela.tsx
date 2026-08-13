import { CopyCheck, Info } from 'lucide-react'
import { Alternador } from '@/componentes/ui/alternador'
import { Input } from '@/componentes/ui/input'
import type { LinhaJanela } from '@/lib/corretores'
import { NOMES_DIAS_CURTOS, minutosDeHora } from '@/lib/datas'
import { cn } from '@/lib/utils'

interface Props {
  linhas: LinhaJanela[]
  aoMudar: (linhas: LinhaJanela[]) => void
  erros: Record<number, string>
}

/**
 * Janela de atendimento, uma linha por dia da semana.
 *
 * Grava em `agendas_horarios`. Dias inativos mantêm o horário salvo,
 * para que desligar a terça e religar semana que vem não obrigue a
 * digitar tudo de novo.
 */
export function EditorJanela({ linhas, aoMudar, erros }: Props) {
  function alterar(diaSemana: number, alteracao: Partial<LinhaJanela>) {
    aoMudar(
      linhas.map((linha) =>
        linha.diaSemana === diaSemana ? { ...linha, ...alteracao } : linha,
      ),
    )
  }

  /** Copia o horário deste dia para todos os outros dias ativos. */
  function replicar(origem: LinhaJanela) {
    aoMudar(
      linhas.map((linha) =>
        linha.diaSemana === origem.diaSemana || !linha.ativo
          ? linha
          : { ...linha, horaInicio: origem.horaInicio, horaFim: origem.horaFim },
      ),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sem esta nota, ninguém liga o "o agente não oferece esse
          horário" à configuração desta tela. */}
      <p className="flex items-start gap-2.5 rounded-lg border border-borda bg-superficie-alternativa px-3.5 py-3 text-sm text-texto-suave">
        <Info className="mt-0.5 size-4 shrink-0 text-destaque" />
        <span>
          Esta janela define exatamente os horários que a API oferece ao agente de IA no
          WhatsApp. Horário fora dela não é oferecido ao cliente e é recusado pelo banco, mesmo
          se agendado pelo painel.
        </span>
      </p>

      <ul className="flex flex-col gap-2">
        {linhas.map((linha) => {
          const erro = erros[linha.diaSemana]
          return (
            <li
              key={linha.diaSemana}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                linha.ativo ? 'border-borda bg-superficie' : 'border-borda bg-superficie-alternativa',
                erro && 'border-destrutivo/45',
              )}
            >
              <Alternador
                marcado={linha.ativo}
                aoMudar={(v) => alterar(linha.diaSemana, { ativo: v })}
                id={`dia-${linha.diaSemana}`}
              />

              <label
                htmlFor={`dia-${linha.diaSemana}`}
                className={cn(
                  'w-12 shrink-0 cursor-pointer text-sm font-medium',
                  linha.ativo ? 'text-texto' : 'text-texto-tenue',
                )}
              >
                {NOMES_DIAS_CURTOS[linha.diaSemana]}
              </label>

              {linha.ativo ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={linha.horaInicio}
                      onChange={(e) => alterar(linha.diaSemana, { horaInicio: e.target.value })}
                      aria-label={`Hora de início de ${NOMES_DIAS_CURTOS[linha.diaSemana]}`}
                      aria-invalid={Boolean(erro)}
                      className="h-9 w-28"
                    />
                    <span className="text-sm text-texto-tenue">às</span>
                    <Input
                      type="time"
                      value={linha.horaFim}
                      onChange={(e) => alterar(linha.diaSemana, { horaFim: e.target.value })}
                      aria-label={`Hora de fim de ${NOMES_DIAS_CURTOS[linha.diaSemana]}`}
                      aria-invalid={Boolean(erro)}
                      className="h-9 w-28"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => replicar(linha)}
                    title="Copiar este horário para os outros dias ativos"
                    className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-texto-tenue transition-colors hover:bg-superficie-alternativa hover:text-destaque"
                  >
                    <CopyCheck className="size-3.5" />
                    Copiar para os demais
                  </button>
                </>
              ) : (
                <span className="text-sm text-texto-tenue">Não atende</span>
              )}

              {erro && (
                <p className="w-full text-xs text-destrutivo" role="alert">
                  {erro}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Hora de fim precisa ser posterior à de início, nos dias ativos. */
export function validarJanela(linhas: LinhaJanela[]): Record<number, string> {
  const erros: Record<number, string> = {}
  for (const linha of linhas) {
    if (!linha.ativo) continue
    if (minutosDeHora(linha.horaFim) <= minutosDeHora(linha.horaInicio)) {
      erros[linha.diaSemana] = 'A hora de fim precisa ser depois da hora de início.'
    }
  }
  return erros
}
