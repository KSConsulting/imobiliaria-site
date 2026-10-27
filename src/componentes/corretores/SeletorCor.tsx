import { Check, Lock } from 'lucide-react'
import { CORES_CORRETORES, corDoTextoSobre, iguais, nomeDaCor } from '@/lib/coresCorretores'
import { cn } from '@/lib/utils'

interface Props {
  valor: string
  aoMudar: (hex: string) => void
  /** Cores já usadas por outros corretores, marcadas como indisponíveis. */
  usadas: { hex: string; porQuem: string }[]
}

/**
 * Paleta fixa de cores de corretor.
 *
 * Cores já em uso ficam bloqueadas e dizem por quem. Duas pessoas com a
 * mesma cor tornam a agenda ilegível justamente nos dias cheios, que
 * são os dias em que olhar a agenda importa.
 */
export function SeletorCor({ valor, aoMudar, usadas }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CORES_CORRETORES.map((cor) => {
          const emUso = usadas.find((usada) => iguais(usada.hex, cor.hex))
          const selecionada = iguais(valor, cor.hex)
          const bloqueada = Boolean(emUso) && !selecionada

          return (
            <button
              key={cor.hex}
              type="button"
              disabled={bloqueada}
              onClick={() => aoMudar(cor.hex)}
              title={bloqueada ? `${cor.nome}, já usada por ${emUso!.porQuem}` : cor.nome}
              aria-label={cor.nome}
              aria-pressed={selecionada}
              className={cn(
                'relative flex size-10 items-center justify-center rounded-lg transition-all',
                selecionada
                  ? 'ring-2 ring-texto ring-offset-2'
                  : 'ring-1 ring-borda ring-offset-1 hover:ring-texto-tenue',
                bloqueada ? 'cursor-not-allowed opacity-35' : 'cursor-pointer',
              )}
              style={{ backgroundColor: cor.hex }}
            >
              {selecionada && (
                <Check className="size-5" style={{ color: corDoTextoSobre(cor.hex) }} />
              )}
              {bloqueada && (
                <Lock className="size-4" style={{ color: corDoTextoSobre(cor.hex) }} />
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-texto-tenue">
        Selecionada: <span className="font-medium text-texto-suave">{nomeDaCor(valor)}</span>. É
        a cor que identifica as visitas deste corretor na agenda.
      </p>
    </div>
  )
}
