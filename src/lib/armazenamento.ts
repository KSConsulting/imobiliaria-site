import { supabase } from '@/lib/supabase'

/** Bucket público das fotos de imóvel. Ver BANCO.md, seção "Storage". */
export const BUCKET_IMOVEIS = 'imoveis'

/**
 * Caminho do arquivo dentro do bucket: `<id_do_imovel>/<aleatório>.webp`.
 *
 * Agrupar por imóvel permite apagar a pasta inteira na exclusão, que é
 * definitiva, sem precisar consultar `imoveis_fotos` — o que importa,
 * porque as linhas já sumiram por CASCADE quando chega a hora de limpar
 * o Storage.
 */
function montarCaminho(idImovel: string, nomeArquivo: string): string {
  const extensao = nomeArquivo.split('.').pop()?.toLowerCase() ?? 'webp'
  return `${idImovel}/${crypto.randomUUID()}.${extensao}`
}

/** URL pública da foto, servida direto pelo Storage ao site. */
export function urlPublica(caminho: string): string {
  return supabase.storage.from(BUCKET_IMOVEIS).getPublicUrl(caminho).data.publicUrl
}

/**
 * Extrai o caminho interno a partir da URL pública salva em
 * `imoveis_fotos.url`. Necessário para apagar o arquivo depois.
 */
export function caminhoDaUrl(url: string): string | null {
  const marcador = `/storage/v1/object/public/${BUCKET_IMOVEIS}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return null
  return decodeURIComponent(url.slice(indice + marcador.length))
}

export async function enviarFoto(idImovel: string, arquivo: File): Promise<string> {
  const caminho = montarCaminho(idImovel, arquivo.name)

  const { error } = await supabase.storage
    .from(BUCKET_IMOVEIS)
    .upload(caminho, arquivo, { cacheControl: '31536000', upsert: false })

  if (error) throw error
  return urlPublica(caminho)
}

/**
 * Remove arquivos do Storage a partir das URLs públicas.
 *
 * Nunca lança: o banco é a fonte da verdade, e um arquivo órfão no
 * Storage é bem menos grave do que uma exclusão que falha pela metade e
 * deixa o registro no lugar.
 */
export async function removerFotos(urls: string[]): Promise<void> {
  const caminhos = urls.map(caminhoDaUrl).filter((c): c is string => Boolean(c))
  if (caminhos.length === 0) return

  const { error } = await supabase.storage.from(BUCKET_IMOVEIS).remove(caminhos)
  if (error) console.warn('[storage] falha ao remover fotos:', error.message)
}

/**
 * Apaga todos os arquivos da pasta do imóvel.
 *
 * Chamado na exclusão do imóvel. O `ON DELETE CASCADE` apaga as linhas
 * de `imoveis_fotos`, mas banco e object storage são sistemas separados
 * — sem esta chamada os arquivos ficariam pagando armazenamento para
 * sempre.
 */
export async function removerPastaDoImovel(idImovel: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET_IMOVEIS).list(idImovel)
  if (error || !data?.length) return

  const caminhos = data.map((arquivo) => `${idImovel}/${arquivo.name}`)
  const { error: erroRemocao } = await supabase.storage.from(BUCKET_IMOVEIS).remove(caminhos)
  if (erroRemocao) console.warn('[storage] falha ao limpar a pasta:', erroRemocao.message)
}
