import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { urlDaFoto } from '@/lib/publico'
import { cn } from '@/lib/utils'

interface Props {
  url: string | null
  alt: string
  className?: string
  /** Proporção do espaço reservado. Ex: `4/3`, `16/9`. */
  proporcao?: string
  /** A primeira foto da dobra carrega imediatamente; o resto é preguiçoso. */
  prioritaria?: boolean
  sizes?: string
  /** Largura servida, em pixels. Ver `LARGURAS_FOTO`. */
  largura?: number
  aoClicar?: () => void
}

/**
 * Foto com espaço reservado e carregamento progressivo.
 *
 * **O espaço é reservado antes de a imagem existir.** O contêiner tem
 * proporção fixa, então a altura já está definida no primeiro quadro:
 * sem isso, cada foto que chega empurra o conteúdo para baixo e o
 * visitante que estava lendo um card perde o lugar — ou, pior, clica no
 * card errado porque a página se moveu debaixo do dedo.
 *
 * O fundo cinza que aparece durante o carregamento não é decoração: é o
 * que torna a espera visível como espera, em vez de branco que parece
 * página quebrada.
 *
 * `loading="lazy"` fora da primeira dobra é o que evita baixar dez fotos
 * grandes que o visitante talvez nunca role até ver — o caso comum no
 * celular, que é de onde vem quase todo o tráfego.
 */
export function FotoProgressiva({
  url,
  alt,
  className,
  proporcao = '4/3',
  prioritaria = false,
  sizes,
  largura,
  aoClicar,
}: Props) {
  const [carregada, setCarregada] = useState(false)
  const [falhou, setFalhou] = useState(false)
  /**
   * Volta para a foto original quando a redimensionada falha.
   *
   * A transformação de imagem do Storage não está disponível em todo
   * projeto Supabase. Sem esta rede de segurança, um projeto sem o
   * recurso exibiria "Sem foto" na vitrine inteira — o site pareceria
   * quebrado por causa de uma otimização.
   */
  const [semTransformacao, setSemTransformacao] = useState(false)

  const src = url ? (semTransformacao ? url : urlDaFoto(url, largura)) : null

  // Foto nova no mesmo componente (trocar a foto principal da galeria)
  // precisa reiniciar o estado, senão a próxima aparece já "carregada"
  // e sem a transição.
  useEffect(() => {
    setCarregada(false)
    setFalhou(false)
    setSemTransformacao(false)
  }, [url])

  return (
    <div
      className={cn('relative overflow-hidden bg-superficie-alternativa', className)}
      style={{ aspectRatio: proporcao }}
      onClick={aoClicar}
    >
      {src && !falhou ? (
        <>
          {!carregada && (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-superficie-alternativa to-borda"
              aria-hidden
            />
          )}
          <img
            src={src}
            alt={alt}
            loading={prioritaria ? 'eager' : 'lazy'}
            // `async` tira a decodificação do caminho de renderização,
            // então a rolagem não trava enquanto a foto é processada.
            decoding="async"
            fetchPriority={prioritaria ? 'high' : 'auto'}
            sizes={sizes}
            onLoad={() => setCarregada(true)}
            onError={() => {
              // Primeira falha com URL transformada: tenta a original.
              // Só depois disso é que a foto é dada como perdida.
              if (!semTransformacao && src !== url) setSemTransformacao(true)
              else setFalhou(true)
            }}
            className={cn(
              'size-full object-cover transition-opacity duration-500',
              carregada ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-texto-tenue">
          <ImageOff className="size-7" strokeWidth={1.5} />
          <span className="text-xs">Sem foto</span>
        </div>
      )}
    </div>
  )
}
