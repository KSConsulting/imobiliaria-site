import { useCallback, useEffect, useState } from 'react'

/**
 * Um bloco do Dashboard que carrega por conta própria.
 *
 * **A página não espera a consulta mais lenta para desenhar nada.** Cada
 * bloco dispara a sua e aparece quando fica pronto, o que importa porque
 * o Dashboard é a primeira tela depois do login: é ela que define a
 * percepção de velocidade do sistema inteiro.
 *
 * Erro fica contido no bloco. Uma consulta que falha mostra o aviso
 * naquele cartão e o resto da página continua útil — bem melhor do que
 * uma tela inteira em branco porque um ranking não respondeu.
 */
export interface EstadoBloco<T> {
  dados: T | null
  carregando: boolean
  erro: boolean
  recarregar: () => void
}

export function usarBloco<T>(
  buscar: () => Promise<T>,
  dependencias: unknown[],
): EstadoBloco<T> {
  const [dados, setDados] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  // `buscar` é recriada a cada render de quem chama; as dependências
  // declaradas é que dizem quando refazer a consulta.
  const executar = useCallback(buscar, dependencias) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(false)

    void (async () => {
      try {
        const resultado = await executar()
        if (ativo) setDados(resultado)
      } catch (falha) {
        console.warn('[dashboard] bloco falhou:', falha)
        if (ativo) setErro(true)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()

    return () => {
      ativo = false
    }
  }, [executar, tentativa])

  return {
    dados,
    carregando,
    erro,
    recarregar: () => setTentativa((n) => n + 1),
  }
}
