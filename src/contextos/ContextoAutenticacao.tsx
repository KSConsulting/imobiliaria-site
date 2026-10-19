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
  /** Verdadeiro durante a verificação da sessão e da liberação do usuário. */
  carregando: boolean
  /** Sessão aberta **e** usuário liberado em `public.usuarios`. */
  autenticado: boolean
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>
  sair: () => Promise<void>
}

const Contexto = createContext<ValorContexto | null>(null)

const ACESSO_NAO_LIBERADO =
  'Este acesso ainda não foi liberado. Peça a quem administra o painel para liberar o seu usuário.'

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  // Id cuja linha de `usuarios` já foi lida. Enquanto difere do id da
  // sessão, a liberação ainda não é conhecida e nada é decidido.
  const [idVerificado, setIdVerificado] = useState<string | null>(null)
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

  // Carrega a linha de `public.usuarios`: o nome de exibição e, antes
  // dele, a liberação. Sessão não é permissão: o cadastro do Supabase
  // Auth responde a qualquer um com a chave anônima, e o trigger espelha
  // toda conta em `usuarios`. Quem não está liberado é desconectado,
  // porque o RLS já não lhe mostraria nada e o painel pareceria quebrado.
  // Ver migration …026 e BANCO.md, "usuarios.liberado".
  useEffect(() => {
    const id = sessao?.user.id
    if (!id) {
      setUsuario(null)
      setIdVerificado(null)
      return
    }

    let ativo = true
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return
        setUsuario(data)
        setIdVerificado(id)
        if (!error && !data?.liberado) void supabase.auth.signOut()
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

    // A senha estava certa, mas isso só prova que a conta existe. O
    // login é que precisa dizer o motivo da recusa: desconectado só pelo
    // efeito acima, a pessoa voltaria ao formulário sem explicação.
    const { data: linha } = await supabase
      .from('usuarios')
      .select('liberado')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!linha?.liberado) {
      await supabase.auth.signOut()
      return { erro: ACESSO_NAO_LIBERADO }
    }

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
        carregando: carregando || Boolean(sessao && idVerificado !== sessao.user.id),
        autenticado: Boolean(sessao && idVerificado === sessao.user.id && usuario?.liberado),
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
