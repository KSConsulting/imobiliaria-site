import { CalendarRange } from 'lucide-react'
import { Input } from '@/componentes/ui/input'
import { Select } from '@/componentes/ui/select'
import { OPCOES_PERIODO, type ChavePeriodo, type Periodo } from '@/lib/dashboard'

interface Props {
  chave: ChavePeriodo
  de: string
  ate: string
  periodo: Periodo
  aoMudarChave: (chave: ChavePeriodo) => void
  aoMudarDatas: (de: string, ate: string) => void
}

/**
 * Seletor global de período.
 *
 * Vale para as duas abas de uma vez. Um seletor por aba pareceria dar
 * mais controle, mas produziria a situação em que o dono compara o
 * tráfego de 7 dias com o funil de 30 e conclui algo errado sobre a
 * conversão do site.
 *
 * A escolha vai para a URL para que o recorte possa ser retomado e
 * compartilhado — inclusive entre a aba Site e a aba Operação, que é
 * onde a comparação faz sentido.
 */
export function SeletorPeriodo({
  chave,
  de,
  ate,
  periodo,
  aoMudarChave,
  aoMudarDatas,
}: Props) {
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2.5">
        <CalendarRange className="size-4 shrink-0 text-texto-tenue" />
        <Select
          value={chave}
          onChange={(e) => aoMudarChave(e.target.value as ChavePeriodo)}
          aria-label="Período"
          className="h-10 w-56"
        >
          {OPCOES_PERIODO.map((opcao) => (
            <option key={opcao.chave} value={opcao.chave}>
              {opcao.rotulo}
            </option>
          ))}
        </Select>
      </div>

      {chave === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={de}
            max={ate || hoje}
            onChange={(e) => aoMudarDatas(e.target.value, ate)}
            aria-label="Data inicial"
            className="h-10 w-40"
          />
          <span className="text-sm text-texto-tenue">até</span>
          <Input
            type="date"
            value={ate}
            min={de}
            max={hoje}
            onChange={(e) => aoMudarDatas(de, e.target.value)}
            aria-label="Data final"
            className="h-10 w-40"
          />
        </div>
      )}

      {/* O período resolvido, por extenso. Com "este mês" ou "últimos 30
          dias" o usuário não sabe exatamente quais datas entraram — e é
          disso que ele precisa para conferir um número com outra fonte. */}
      <p className="text-sm text-texto-tenue sm:ml-auto">
        {formatarIntervalo(periodo)}
      </p>
    </div>
  )
}

function formatarIntervalo(periodo: Periodo): string {
  const formatador = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  // `fim` é exclusivo: o último dia exibido é o anterior a ele.
  const ultimoDia = new Date(periodo.fim.getTime() - 1)
  return `${formatador.format(periodo.inicio)} a ${formatador.format(ultimoDia)}`
}
