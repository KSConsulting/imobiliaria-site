import { Globe, LayoutDashboard, Plug } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROTULOS_DESTINO, type Destino } from '@/lib/configuracoes'
import { cn } from '@/lib/utils'

const ICONES: Record<Destino, LucideIcon> = {
  painel: LayoutDashboard,
  site: Globe,
  api: Plug,
}

const EXPLICACOES: Record<Destino, string> = {
  painel: 'Aparece dentro do painel: sidebar, login, título da aba.',
  site: 'Aparece no site público, visível para qualquer visitante.',
  api: 'Vai no JSON que o agente de IA e outras integrações consomem.',
}

/**
 * Onde os dados de um grupo aparecem.
 *
 * Sem essa marcação, o formulário parece cadastro interno. Alguém
 * preenche o WhatsApp achando que é anotação da equipe e publica o
 * número pessoal na vitrine — ou deixa o campo vazio por cautela e o
 * site fica sem o único botão que gera contato. Nos dois casos o erro é
 * invisível até alguém reclamar.
 */
export function DestinoDado({ destinos, className }: { destinos: Destino[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {destinos.map((destino) => {
        const Icone = ICONES[destino]
        return (
          <span
            key={destino}
            title={EXPLICACOES[destino]}
            className="inline-flex items-center gap-1.5 rounded-full border border-borda bg-superficie-alternativa px-2.5 py-1 text-xs font-medium text-texto-suave"
          >
            <Icone className="size-3.5" strokeWidth={2} />
            {ROTULOS_DESTINO[destino]}
          </span>
        )
      })}
    </div>
  )
}
