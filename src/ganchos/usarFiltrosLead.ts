import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FILTROS_LEAD_VAZIOS,
  ORDENACAO_PADRAO,
  type ColunaOrdenacao,
  type FiltrosLead,
  type Ordenacao,
} from '@/lib/leads'

const CHAVES = Object.keys(FILTROS_LEAD_VAZIOS) as (keyof FiltrosLead)[]

const COLUNAS_ORDENAVEIS: ColunaOrdenacao[] = [
  'nome',
  'status',
  'origem',
  'ultima_mensagem',
  'created_at',
]

/**
 * Filtros de Leads e Funil, com a URL como fonte de verdade.
 *
 * **Não é preferência de estilo.** O `AlternadorLeadsFunil` troca de tela
 * carregando a query string atual: em `useState` local o filtro morreria
 * na troca, e o usuário refaria o mesmo recorte toda vez que quisesse
 * ver os mesmos leads em outra visualização. As duas telas leem daqui,
 * então o alternador funciona sem que nenhuma das duas saiba da outra.
 *
 * De quebra, o link de uma lista filtrada pode ser colado no grupo e
 * abre igual do outro lado, e o botão voltar do navegador desfaz um
 * filtro em vez de sair da página.
 */
export function usarFiltrosLead() {
  const [parametros, definirParametros] = useSearchParams()

  const filtros = useMemo<FiltrosLead>(() => {
    const resultado = { ...FILTROS_LEAD_VAZIOS }
    for (const chave of CHAVES) {
      resultado[chave] = parametros.get(chave) ?? ''
    }
    return resultado
  }, [parametros])

  const definirFiltro = useCallback(
    (chave: keyof FiltrosLead, valor: string) => {
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

  /** Liga ou desliga um status da seleção múltipla. */
  const alternarStatus = useCallback(
    (status: string) => {
      const atuais = (parametros.get('status') ?? '').split(',').filter(Boolean)
      const proximos = atuais.includes(status)
        ? atuais.filter((valor) => valor !== status)
        : [...atuais, status]
      definirFiltro('status', proximos.join(','))
    },
    [parametros, definirFiltro],
  )

  const limparFiltros = useCallback(() => {
    definirParametros(
      (anterior) => {
        // Preserva o que não é filtro — a ordenação escolhida não deve
        // voltar ao padrão só porque a busca foi limpa.
        const proximo = new URLSearchParams(anterior)
        for (const chave of CHAVES) proximo.delete(chave)
        return proximo
      },
      { replace: true },
    )
  }, [definirParametros])

  return { filtros, definirFiltro, alternarStatus, limparFiltros }
}

/** Ordenação da tabela de Leads, também guardada na URL. */
export function usarOrdenacaoLead() {
  const [parametros, definirParametros] = useSearchParams()

  const ordenacao = useMemo<Ordenacao>(() => {
    const coluna = parametros.get('ordenar') as ColunaOrdenacao | null
    if (!coluna || !COLUNAS_ORDENAVEIS.includes(coluna)) return ORDENACAO_PADRAO
    return { coluna, ascendente: parametros.get('direcao') === 'asc' }
  }, [parametros])

  /**
   * Clique no cabeçalho.
   *
   * Clicar de novo na mesma coluna inverte; trocar de coluna começa pela
   * direção mais útil dela — texto de A a Z, data da mais recente para a
   * mais antiga. Começar toda coluna crescente colocaria os leads mais
   * velhos no topo, que é o oposto do que se procura ao abrir a tela.
   */
  const ordenarPor = useCallback(
    (coluna: ColunaOrdenacao) => {
      const mesmaColuna = ordenacao.coluna === coluna
      const ascendente = mesmaColuna
        ? !ordenacao.ascendente
        : coluna !== 'created_at' && coluna !== 'ultima_mensagem'

      definirParametros(
        (anterior) => {
          const proximo = new URLSearchParams(anterior)
          const padrao =
            coluna === ORDENACAO_PADRAO.coluna && ascendente === ORDENACAO_PADRAO.ascendente

          if (padrao) {
            proximo.delete('ordenar')
            proximo.delete('direcao')
          } else {
            proximo.set('ordenar', coluna)
            proximo.set('direcao', ascendente ? 'asc' : 'desc')
          }
          return proximo
        },
        { replace: true },
      )
    },
    [ordenacao, definirParametros],
  )

  return { ordenacao, ordenarPor }
}
