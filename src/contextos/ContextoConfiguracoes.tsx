import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, type Configuracao } from '@/lib/supabase'

/** Nome neutro exibido enquanto as configurações não chegaram. */
export const NOME_NEUTRO = 'ImobFlow'

export type ModoConfiguracoes = 'painel' | 'publico'

interface ValorContexto {
  configuracoes: Configuracao | null
  carregando: boolean
  /** Nome da imobiliária, já com o texto neutro de carregamento. */
  nomeNegocio: string
  /** Modo em vigor. Exposto para depuração e para os testes. */
  modo: ModoConfiguracoes
  recarregar: () => Promise<void>
}

const Contexto = createContext<ValorContexto | null>(null)

/**
 * Decide o modo do contexto de configurações a partir da rota.
 *
 * A distinção é explícita e vive AQUI, não no lugar onde o provider foi
 * montado — a diferença é comportamental, não estrutural, e precisa
 * sobreviver a uma futura reorganização da árvore de componentes.
 *
 * - `/painel/*` e `/login` → modo `painel`
 * - qualquer outra rota     → modo `publico`
 */
export function modoPorRota(caminho: string): ModoConfiguracoes {
  return caminho === '/login' || caminho === '/painel' || caminho.startsWith('/painel/')
    ? 'painel'
    : 'publico'
}

/**
 * Carrega o registro único de `configuracoes` e o distribui para toda a
 * aplicação — sidebar, login e site público.
 *
 * **Por que o comportamento muda por área.** O Realtime do Supabase
 * trabalha sobre conexão autenticada. Ativar a subscription
 * indiscriminadamente faz uma de duas coisas ruins: ou ela falha em
 * silêncio no site público, ou obriga a área pública a depender do
 * contexto autenticado — e aí o acesso anônimo quebra.
 *
 * - **modo `painel`** — leitura + subscription ativa. O que o dono salva
 *   na tela de Configurações aparece na sidebar na hora, sem F5.
 * - **modo `publico`** — leitura anônima simples, uma vez no
 *   carregamento. Basta: o visitante não altera configuração nenhuma.
 */
export function ProvedorConfiguracoes({
  modo,
  children,
}: {
  modo: ModoConfiguracoes
  children: ReactNode
}) {
  const [configuracoes, setConfiguracoes] = useState<Configuracao | null>(null)
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    const { data, error } = await supabase.from('configuracoes').select('*').maybeSingle()
    if (error) {
      console.warn('[configuracoes] falha ao carregar:', error.message)
    }
    setConfiguracoes(data ?? null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    void buscar()
  }, [buscar])

  useEffect(() => {
    if (modo !== 'painel') return

    const canal = supabase
      .channel('configuracoes-painel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setConfiguracoes(null)
            return
          }
          setConfiguracoes(payload.new as Configuracao)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [modo])

  return (
    <Contexto.Provider
      value={{
        configuracoes,
        carregando,
        nomeNegocio: configuracoes?.nome_negocio ?? NOME_NEUTRO,
        modo,
        recarregar: buscar,
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function usarConfiguracoes() {
  const contexto = useContext(Contexto)
  if (!contexto) {
    throw new Error('usarConfiguracoes precisa estar dentro de <ProvedorConfiguracoes>.')
  }
  return contexto
}
