import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { FotoProgressiva } from '@/componentes/publico/FotoProgressiva'
import { LARGURAS_FOTO, type FotoPublica } from '@/lib/publico'
import { cn } from '@/lib/utils'

interface Props {
  fotos: FotoPublica[]
  titulo: string
}

/**
 * Galeria do imóvel.
 *
 * No desktop, foto grande com miniaturas embaixo. No celular, carrossel
 * deslizável com rolagem por encaixe — arrastar é o gesto natural ali, e
 * miniaturas de 60 pixels seriam alvos pequenos demais para o dedo.
 *
 * Clicar abre em tela cheia, com navegação por seta e por teclado. A
 * foto é o que vende o imóvel: precisa poder ser vista grande.
 */
export function GaleriaImovel({ fotos, titulo }: Props) {
  const [atual, setAtual] = useState(0)
  const [ampliada, setAmpliada] = useState(false)

  const total = fotos.length

  const anterior = useCallback(() => {
    setAtual((i) => (i - 1 + total) % total)
  }, [total])

  const proxima = useCallback(() => {
    setAtual((i) => (i + 1) % total)
  }, [total])

  // Teclado no modo tela cheia. Esc fecha porque é o que todo mundo
  // tenta primeiro.
  useEffect(() => {
    if (!ampliada) return

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAmpliada(false)
      if (evento.key === 'ArrowLeft') anterior()
      if (evento.key === 'ArrowRight') proxima()
    }

    document.addEventListener('keydown', aoTeclar)
    // Trava a rolagem do fundo: sem isso, deslizar na foto ampliada rola
    // a página atrás dela.
    const overflowOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowOriginal
    }
  }, [ampliada, anterior, proxima])

  if (total === 0) {
    return (
      <FotoProgressiva
        url={null}
        alt={titulo}
        proporcao="16/10"
        className="w-full rounded-2xl border border-borda"
      />
    )
  }

  return (
    <>
      {/* ---------------- Celular: carrossel ---------------- */}
      <div className="sm:hidden">
        <div className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5">
          {fotos.map((foto, indice) => (
            <button
              key={foto.url}
              type="button"
              onClick={() => {
                setAtual(indice)
                setAmpliada(true)
              }}
              className="w-[85vw] shrink-0 cursor-pointer snap-center overflow-hidden rounded-2xl"
            >
              <FotoProgressiva
                url={foto.url}
                alt={`${titulo} — foto ${indice + 1}`}
                proporcao="4/3"
                prioritaria={indice === 0}
                largura={LARGURAS_FOTO.cartao}
                sizes="85vw"
                className="w-full"
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-texto-tenue">
          {total === 1 ? '1 foto' : `${total} fotos`} · deslize para ver
        </p>
      </div>

      {/* ---------------- Desktop: principal + miniaturas ---------------- */}
      <div className="hidden flex-col gap-3 sm:flex">
        <div className="group relative overflow-hidden rounded-2xl">
          <FotoProgressiva
            url={fotos[atual].url}
            alt={`${titulo} — foto ${atual + 1}`}
            proporcao="16/10"
            prioritaria
            largura={LARGURAS_FOTO.principal}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="w-full cursor-zoom-in"
            aoClicar={() => setAmpliada(true)}
          />

          <button
            type="button"
            onClick={() => setAmpliada(true)}
            aria-label="Ver em tela cheia"
            className="absolute right-4 top-4 flex size-10 cursor-pointer items-center justify-center rounded-full bg-escuro/60 text-claro opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <Expand className="size-4" />
          </button>

          {total > 1 && (
            <>
              <SetaGaleria direcao="anterior" aoClicar={anterior} />
              <SetaGaleria direcao="proxima" aoClicar={proxima} />
              <span className="absolute bottom-4 right-4 rounded-full bg-escuro/60 px-3 py-1 text-xs font-medium text-claro backdrop-blur-sm">
                {atual + 1} / {total}
              </span>
            </>
          )}
        </div>

        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fotos.map((foto, indice) => (
              <button
                key={foto.url}
                type="button"
                onClick={() => setAtual(indice)}
                aria-label={`Ver foto ${indice + 1}`}
                aria-current={indice === atual}
                className={cn(
                  'w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors',
                  indice === atual ? 'border-destaque' : 'border-transparent hover:border-borda-forte',
                )}
              >
                <FotoProgressiva
                  url={foto.url}
                  alt=""
                  proporcao="4/3"
                  largura={LARGURAS_FOTO.miniatura}
                  sizes="96px"
                  className="w-full"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- Tela cheia ---------------- */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-escuro/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${titulo}`}
        >
          <div className="flex shrink-0 items-center justify-between p-4">
            <span className="text-sm font-medium text-claro/80">
              {atual + 1} de {total}
            </span>
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Fechar"
              className="flex size-11 cursor-pointer items-center justify-center rounded-full text-claro transition-colors hover:bg-claro/15"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            <img
              src={fotos[atual].url}
              alt={`${titulo} — foto ${atual + 1}`}
              className="max-h-full max-w-full object-contain"
            />

            {total > 1 && (
              <>
                <SetaGaleria direcao="anterior" aoClicar={anterior} clara />
                <SetaGaleria direcao="proxima" aoClicar={proxima} clara />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function SetaGaleria({
  direcao,
  aoClicar,
  clara,
}: {
  direcao: 'anterior' | 'proxima'
  aoClicar: () => void
  clara?: boolean
}) {
  const Icone = direcao === 'anterior' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        aoClicar()
      }}
      aria-label={direcao === 'anterior' ? 'Foto anterior' : 'Próxima foto'}
      className={cn(
        'absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full backdrop-blur-sm transition-colors',
        direcao === 'anterior' ? 'left-4' : 'right-4',
        clara
          ? 'bg-claro/15 text-claro hover:bg-claro/28'
          : 'bg-escuro/55 text-claro hover:bg-escuro/75',
      )}
    >
      <Icone className="size-5" />
    </button>
  )
}
