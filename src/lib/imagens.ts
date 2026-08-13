/**
 * Compressão de imagem no navegador, antes do upload.
 *
 * Foto de imóvel vem de celular com 4 a 12 MB. Sem compressão, a
 * vitrine — a parte do sistema que mais precisa ser rápida — carrega
 * dezenas de megabytes por página, e a conta do Storage cresce junto.
 *
 * Feito com `createImageBitmap` + `canvas`, sem dependência externa.
 */

/** Maior dimensão da imagem final, em pixels. */
const LADO_MAXIMO = 1920
/** Qualidade do WEBP. 0.82 é o ponto em que o artefato deixa de ser visível. */
const QUALIDADE = 0.82
/** Acima disso, o arquivo é recusado antes mesmo de tentar comprimir. */
export const TAMANHO_MAXIMO_ENTRADA = 25 * 1024 * 1024

export const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export interface ImagemComprimida {
  arquivo: File
  /** URL local para preview imediato. Libere com `URL.revokeObjectURL`. */
  previa: string
  tamanhoOriginal: number
  tamanhoFinal: number
  largura: number
  altura: number
}

export function ehImagemAceita(arquivo: File): boolean {
  return TIPOS_ACEITOS.includes(arquivo.type.toLowerCase())
}

/**
 * Reduz a imagem para no máximo 1920px no maior lado e a converte para
 * WEBP.
 *
 * Se qualquer etapa falhar, devolve o arquivo original em vez de
 * quebrar o upload: foto grande é melhor do que foto nenhuma.
 */
export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  const original = arquivo.size

  try {
    // `imageOrientation: 'from-image'` aplica a rotação do EXIF. Sem
    // isso, foto tirada na vertical pelo celular sobe deitada.
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura

    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('canvas indisponível')

    contexto.imageSmoothingEnabled = true
    contexto.imageSmoothingQuality = 'high'
    contexto.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALIDADE),
    )
    if (!blob) throw new Error('falha ao gerar o webp')

    // Se a "compressão" aumentou o arquivo (acontece com imagens já
    // otimizadas e pequenas), fica com o original.
    if (blob.size >= original && escala === 1) {
      return {
        arquivo,
        previa: URL.createObjectURL(arquivo),
        tamanhoOriginal: original,
        tamanhoFinal: original,
        largura: bitmap.width,
        altura: bitmap.height,
      }
    }

    const comprimido = new File([blob], trocarExtensaoParaWebp(arquivo.name), {
      type: 'image/webp',
    })

    return {
      arquivo: comprimido,
      previa: URL.createObjectURL(blob),
      tamanhoOriginal: original,
      tamanhoFinal: blob.size,
      largura,
      altura,
    }
  } catch (erro) {
    console.warn('[imagens] compressão falhou, usando o arquivo original:', erro)
    return {
      arquivo,
      previa: URL.createObjectURL(arquivo),
      tamanhoOriginal: original,
      tamanhoFinal: original,
      largura: 0,
      altura: 0,
    }
  }
}

function trocarExtensaoParaWebp(nome: string): string {
  return nome.replace(/\.[^.]+$/, '') + '.webp'
}
