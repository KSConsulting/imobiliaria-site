import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FILTROS_VITRINE_VAZIOS, type FiltrosVitrine } from '@/lib/publico'

const CHAVES = Object.keys(FILTROS_VITRINE_VAZIOS) as (keyof FiltrosVitrine)[]

/**
 * Filtros da vitrine, com a URL como fonte de verdade.
 *
 * Aqui a razão é diferente da do painel. **O visitante compartilha a
 * busca.** O comportamento real é procurar apartamento de três quartos
 * no bairro X até uns tantos mil, e mandar o link para o cônjuge no
 * WhatsApp. Se o filtro morasse em `useState`, quem recebe o link abriria
 * a listagem inteira sem recorte nenhum, e a conversa viraria "não é essa,
 * filtra de novo".
 *
 * De quebra, o botão voltar do navegador desfaz um filtro em vez de sair
 * do site — e no celular o botão voltar é o principal meio de navegação.
 */
export function usarFiltrosVitrine() {
  const [parametros, definirParametros] = useSearchParams()

  const filtros = useMemo<FiltrosVitrine>(() => {
    const resultado = { ...FILTROS_VITRINE_VAZIOS }
    for (const chave of CHAVES) {
      resultado[chave] = parametros.get(chave) ?? ''
    }
    return resultado
  }, [parametros])

  const definirFiltro = useCallback(
    (chave: keyof FiltrosVitrine, valor: string) => {
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

  /** Aplica vários filtros de uma vez — o caso do formulário do hero. */
  const definirVarios = useCallback(
    (valores: Partial<FiltrosVitrine>) => {
      definirParametros(
        (anterior) => {
          const proximo = new URLSearchParams(anterior)
          for (const [chave, valor] of Object.entries(valores)) {
            if (valor) proximo.set(chave, valor)
            else proximo.delete(chave)
          }
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
        // A ordenação sobrevive: quem limpou a busca não pediu para
        // voltar a ordenar por mais recentes.
        const proximo = new URLSearchParams(anterior)
        for (const chave of CHAVES) {
          if (chave !== 'ordem') proximo.delete(chave)
        }
        return proximo
      },
      { replace: true },
    )
  }, [definirParametros])

  return { filtros, definirFiltro, definirVarios, limparFiltros }
}

/** Monta a query string da listagem a partir de um recorte de filtros. */
export function queryDaBusca(valores: Partial<FiltrosVitrine>): string {
  const parametros = new URLSearchParams()
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor) parametros.set(chave, valor)
  }
  const texto = parametros.toString()
  return texto ? `?${texto}` : ''
}
