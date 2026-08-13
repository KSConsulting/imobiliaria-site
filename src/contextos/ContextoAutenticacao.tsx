import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type Usuario } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { traduzir } from '@/lib/notificacoes'

interface ValorContexto {
  sessao: Session | null
  usuarioAuth: User | null
  /** Linha correspondente em `public.usuarios`, com o nome de exibição. */
  usuario: Usuario | null
  /** Verdadeiro durante a verificação inicial da sessão. */
  carregando: boolean
  autenticado: boolean
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>
  sair: () => Promise<void>
}

const Contexto = createContext<ValorContexto | null>(null)

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  // Começa em `true`: até a verificação terminar não sabemos se há
  // sessão. É esse estado que impede o usuário autenticado de ser
  // jogado para o login por um instante ao recarregar a página.
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSessao(data.session)
      setCarregando(false)
    })

    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return
      setSessao(novaSessao)
      setCarregando(false)
    })

    return () => {
      ativo = false
      inscricao.subscription.unsubscribe()
    }
  }, [])

  // Carrega a linha de `public.usuarios` para obter o nome de exibição.
  // O registro é criado automaticamente por trigger em auth.users, então
  // ele existe — ver BANCO.md, "Espelhamento de auth.users".
  useEffect(() => {
    const id = sessao?.user.id
    if (!id) {
      setUsuario(null)
      return
    }

    let ativo = true
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setUsuario(data)
      })

    return () => {
      ativo = false
    }
  }, [sessao?.user.id])

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) return { erro: traduzir(error.message) }

    void registrarLog({
      acao: Acoes.loginRealizado,
      tabela: 'usuarios',
      idRegistro: data.user?.id,
    })
    return { erro: null }
  }, [])

  const sair = useCallback(async () => {
    // Registra antes do signOut: depois a sessão já não existe e a
    // política de RLS de logs_sistema recusaria a inserção.
    await registrarLog({
      acao: Acoes.logoutRealizado,
      tabela: 'usuarios',
      idRegistro: sessao?.user.id,
    })
    await supabase.auth.signOut()
  }, [sessao?.user.id])

  return (
    <Contexto.Provider
      value={{
        sessao,
        usuarioAuth: sessao?.user ?? null,
        usuario,
        carregando,
        autenticado: Boolean(sessao),
        entrar,
        sair,
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function usarAutenticacao() {
  const contexto = useContext(Contexto)
  if (!contexto) {
    throw new Error('usarAutenticacao precisa estar dentro de <ProvedorAutenticacao>.')
  }
  return contexto
}
