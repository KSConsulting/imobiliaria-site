import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FILTROS_VAZIOS, type FiltrosImovel } from '@/lib/imoveis'

const CHAVES = Object.keys(FILTROS_VAZIOS) as (keyof FiltrosImovel)[]

/**
 * Filtros da listagem sincronizados com a query string.
 *
 * A URL é a fonte da verdade, não o `useState`. Assim o usuário copia o
 * link de uma busca filtrada, manda no grupo e quem abrir vê exatamente
 * a mesma lista — e o botão voltar do navegador desfaz um filtro em vez
 * de sair da página.
 *
 * É também o que faz o alternador Leads/Funil funcionar na Etapa 5, que
 * carrega a query string de uma tela para a outra.
 */
export function usarFiltrosImovel() {
  const [parametros, definirParametros] = useSearchParams()

  const filtros = useMemo<FiltrosImovel>(() => {
    const resultado = { ...FILTROS_VAZIOS }
    for (const chave of CHAVES) {
      resultado[chave] = parametros.get(chave) ?? ''
    }
    return resultado
  }, [parametros])

  const definirFiltro = useCallback(
    (chave: keyof FiltrosImovel, valor: string) => {
      definirParametros(
        (anterior) => {
          const proximo = new URLSearchParams(anterior)
          if (valor) proximo.set(chave, valor)
          else proximo.delete(chave)
          return proximo
        },
        { replace: true },
      )
    },
    [definirParametros],
  )

  const limparFiltros = useCallback(() => {
    definirParametros(
      (anterior) => {
        // Preserva parâmetros que não são filtros — a visualização, por
        // exemplo, não deve voltar para grade só porque limpei a busca.
        const proximo = new URLSearchParams(anterior)
        for (const chave of CHAVES) proximo.delete(chave)
        return proximo
      },
      { replace: true },
    )
  }, [definirParametros])

  return { filtros, definirFiltro, limparFiltros }
}

/** Visualização da listagem: grade de cards ou lista compacta. */
export function usarVisualizacao() {
  const [parametros, definirParametros] = useSearchParams()
  const visualizacao = parametros.get('ver') === 'lista' ? 'lista' : 'grade'

  const definirVisualizacao = useCallback(
    (valor: 'grade' | 'lista') => {
      definirParametros(
        (anterior) => {
          const proximo = new URLSearchParams(anterior)
          if (valor === 'lista') proximo.set('ver', 'lista')
          else proximo.delete('ver')
          return proximo
        },
        { replace: true },
      )
    },
    [definirParametros],
  )

  return { visualizacao, definirVisualizacao } as const
}
