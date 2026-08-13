import { supabase } from '@/lib/supabase'
import { enviarFoto, removerFotos } from '@/lib/armazenamento'
import type { FotoEmEdicao } from '@/componentes/imoveis/GerenciadorFotos'
import type { FotoImovel } from '@/lib/imoveis'

/**
 * Sincroniza a galeria do imóvel com o que está na tela.
 *
 * A ordem das operações não é arbitrária. `imoveis_fotos` tem um índice
 * único parcial `(id_imovel) WHERE capa` — no meio de uma reordenação é
 * fácil existirem duas capas por um instante, e o banco recusaria.
 * Por isso zeramos todas as capas antes de gravar qualquer coisa e
 * definimos a capa nova apenas no fim, numa única linha.
 *
 * O trigger de limite de 10 fotos também pesa aqui: as remoções vêm
 * antes das inserções, senão trocar 3 fotos num imóvel que já tem 10
 * estouraria o limite no meio do caminho.
 */
export async function sincronizarFotos(
  idImovel: string,
  fotos: FotoEmEdicao[],
  originais: FotoImovel[],
): Promise<void> {
  // 1. Remover as que saíram — banco e Storage.
  const chavesAtuais = new Set(fotos.map((f) => f.id).filter(Boolean))
  const removidas = originais.filter((original) => !chavesAtuais.has(original.id))

  if (removidas.length > 0) {
    const { error } = await supabase
      .from('imoveis_fotos')
      .delete()
      .in(
        'id',
        removidas.map((f) => f.id),
      )
    if (error) throw error
    await removerFotos(removidas.map((f) => f.url))
  }

  // 2. Zerar todas as capas antes de mexer na ordem.
  const { error: erroCapa } = await supabase
    .from('imoveis_fotos')
    .update({ capa: false })
    .eq('id_imovel', idImovel)
    .eq('capa', true)
  if (erroCapa) throw erroCapa

  // 3. Enviar as novas e inserir as linhas, já sem capa.
  const novas = fotos.map((foto, ordem) => ({ foto, ordem })).filter(({ foto }) => foto.arquivo)

  const idsPorChave = new Map<string, string>()
  for (const { foto, ordem } of novas) {
    const url = await enviarFoto(idImovel, foto.arquivo!)
    const { data, error } = await supabase
      .from('imoveis_fotos')
      .insert({ id_imovel: idImovel, url, ordem, capa: false })
      .select('id')
      .single()
    if (error) throw error
    idsPorChave.set(foto.chave, data.id)
  }

  // 4. Atualizar a ordem das que já existiam.
  for (const [ordem, foto] of fotos.entries()) {
    if (!foto.id) continue
    const { error } = await supabase
      .from('imoveis_fotos')
      .update({ ordem })
      .eq('id', foto.id)
    if (error) throw error
  }

  // 5. Definir a capa, agora que existe no máximo uma candidata.
  //    Sem escolha explícita, a primeira da ordem assume.
  const escolhida = fotos.find((f) => f.capa) ?? fotos[0]
  if (escolhida) {
    const id = escolhida.id ?? idsPorChave.get(escolhida.chave)
    if (id) {
      const { error } = await supabase
        .from('imoveis_fotos')
        .update({ capa: true })
        .eq('id', id)
      if (error) throw error
    }
  }
}
