import { AlertTriangle, CopyCheck, MessageSquareQuote } from 'lucide-react'
import { Alternador } from '@/componentes/ui/alternador'
import { Input } from '@/componentes/ui/input'
import { minutosDeHora } from '@/lib/datas'
import {
  NOMES_DIAS_FUNCIONAMENTO,
  resumoHorario,
  type AvisoCobertura,
  type DiaFuncionamento,
} from '@/lib/horarioFuncionamento'
import { cn } from '@/lib/utils'

interface Props {
  dias: DiaFuncionamento[]
  aoMudar: (dias: DiaFuncionamento[]) => void
  erros: Record<number, string>
  /** Onde o declarado promete mais do que os corretores cobrem. */
  avisos: AvisoCobertura[]
}

/**
 * Horário de atendimento ao público, uma linha por dia da semana.
 *
 * **Dia fechado guarda o horário digitado**, igual ao editor de janela do
 * corretor: desligar o sábado e religá-lo em dezembro não deve obrigar a
 * redigitar. O que vai para o banco é só o que está aberto.
 *
 * A prévia embaixo não é enfeite: **é a frase exata que o agente fala no
 * WhatsApp**, montada pela mesma regra do banco. Sem ela, o operador
 * marca sete alternadores e salva sem nunca ver o que o cliente vai
 * receber, que é a única coisa que este campo produz.
 */
export function EditorHorarioAtendimento({ dias, aoMudar, erros, avisos }: Props) {
  const resumo = resumoHorario(dias)

  function alterar(dia: number, alteracao: Partial<DiaFuncionamento>) {
    aoMudar(dias.map((linha) => (linha.dia === dia ? { ...linha, ...alteracao } : linha)))
  }

  /** Copia este horário para os outros dias abertos. */
  function replicar(origem: DiaFuncionamento) {
    aoMudar(
      dias.map((linha) =>
        linha.dia === origem.dia || !linha.aberto
          ? linha
          : { ...linha, abre: origem.abre, fecha: origem.fecha },
      ),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {dias.map((linha) => {
          const erro = erros[linha.dia]
          const nome = NOMES_DIAS_FUNCIONAMENTO[linha.dia]

          return (
            <li
              key={linha.dia}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                linha.aberto
                  ? 'border-borda bg-superficie'
                  : 'border-borda bg-superficie-alternativa',
                erro && 'border-destrutivo/45',
              )}
            >
              <Alternador
                marcado={linha.aberto}
                aoMudar={(v) => alterar(linha.dia, { aberto: v })}
                id={`atendimento-${linha.dia}`}
              />

              <label
                htmlFor={`atendimento-${linha.dia}`}
                className={cn(
                  'w-20 shrink-0 cursor-pointer text-sm font-medium capitalize',
                  linha.aberto ? 'text-texto' : 'text-texto-tenue',
                )}
              >
                {nome}
              </label>

              {linha.aberto ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={linha.abre}
                      onChange={(e) => alterar(linha.dia, { abre: e.target.value })}
                      aria-label={`Abre ${nome}`}
                      aria-invalid={Boolean(erro)}
                      className="h-9 w-28"
                    />
                    <span className="text-sm text-texto-tenue">às</span>
                    <Input
                      type="time"
                      value={linha.fecha}
                      onChange={(e) => alterar(linha.dia, { fecha: e.target.value })}
                      aria-label={`Fecha ${nome}`}
                      aria-invalid={Boolean(erro)}
                      className="h-9 w-28"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => replicar(linha)}
                    title="Copiar este horário para os outros dias abertos"
                    className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-texto-tenue transition-colors hover:bg-superficie-alternativa hover:text-destaque"
                  >
                    <CopyCheck className="size-3.5" />
                    Copiar para os demais
                  </button>
                </>
              ) : (
                <span className="text-sm text-texto-tenue">Fechado</span>
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

      {/* A frase pronta. Nada marcado ainda não mostra bloco vazio: o
          estado "não informado" já está dito pelos sete alternadores
          desligados logo acima. */}
      {resumo && (
        <div className="flex items-start gap-2.5 rounded-lg border border-borda bg-superficie-alternativa px-3.5 py-3">
          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-destaque" />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-texto-suave">
              O agente vai responder assim no WhatsApp
            </p>
            <p className="text-sm leading-relaxed text-texto">Atendimento: {resumo}.</p>
          </div>
        </div>
      )}

      {/* Avisa, não bloqueia. O horário daqui não recusa agendamento
          nenhum, mas o cliente lê ele: declarar mais largo do que a
          equipe cobre faz o agente prometer o que o banco vai negar. */}
      {avisos.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-alerta/30 bg-alerta/6 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-texto-suave">
              Este horário é maior do que a agenda dos corretores cobre
            </p>
            <ul className="flex flex-col gap-1">
              {avisos.map((aviso, i) => (
                <li key={`${aviso.dia}-${i}`} className="text-xs leading-relaxed text-texto-suave">
                  {aviso.texto}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-texto-tenue">
              Não impede de salvar. Só significa que o cliente pode pedir uma visita num horário
              que a agenda vai recusar. Ajuste aqui ou amplie a janela em Corretores.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Hora de fechar precisa ser depois da de abrir, nos dias abertos. */
export function validarHorarioAtendimento(dias: DiaFuncionamento[]): Record<number, string> {
  const erros: Record<number, string> = {}
  for (const linha of dias) {
    if (!linha.aberto) continue
    if (minutosDeHora(linha.fecha) <= minutosDeHora(linha.abre)) {
      erros[linha.dia] = 'O horário de fechar precisa ser depois do de abrir.'
    }
  }
  return erros
}
