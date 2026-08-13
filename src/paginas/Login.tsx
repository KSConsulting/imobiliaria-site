import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  Columns3,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
} from 'lucide-react'
import { usarAutenticacao } from '@/contextos/ContextoAutenticacao'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Skeleton } from '@/componentes/ui/skeleton'
import { notificar } from '@/lib/notificacoes'

/**
 * As quatro áreas do painel, na coluna visual.
 *
 * Não é decoração: quem abre o login pela primeira vez descobre aqui o
 * que o sistema faz, sem precisar entrar. Os ícones são do ramo, e cada
 * um repete uma área que existe de verdade na sidebar.
 */
const AREAS = [
  {
    icone: Building2,
    titulo: 'Carteira de imóveis',
    apoio: 'Fotos, valores e status num cadastro só',
  },
  {
    icone: CalendarCheck,
    titulo: 'Agenda de visitas',
    apoio: 'Blocos de 30 minutos, por corretor',
  },
  {
    icone: Columns3,
    titulo: 'Funil de atendimento',
    apoio: 'Do primeiro contato à chave na mão',
  },
  {
    icone: Globe,
    titulo: 'Vitrine sempre no ar',
    apoio: 'Salvou no painel, mudou no site',
  },
] as const

export function Login() {
  const { autenticado, carregando: verificandoSessao, entrar } = usarAutenticacao()
  const {
    configuracoes,
    carregando: carregandoConfig,
    nomeNegocio,
  } = usarConfiguracoes()
  const navegar = useNavigate()
  const localizacao = useLocation()
  usarTituloPagina('Entrar', 'painel')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  const destino = (localizacao.state as { de?: string } | null)?.de ?? '/painel'

  // Enquanto a sessão é verificada, não decida nada: renderizar o
  // formulário aqui faria o campo piscar antes do redirecionamento.
  if (verificandoSessao) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-fundo">
        <Loader2 className="size-6 animate-spin text-destaque" />
      </div>
    )
  }

  // Já autenticado não vê o login.
  if (autenticado) return <Navigate to={destino} replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (!email.trim() || !senha) {
      setErro('Informe o email e a senha.')
      return
    }

    setEntrando(true)
    const { erro: falha } = await entrar(email, senha)
    setEntrando(false)

    if (falha) {
      setErro(falha)
      return
    }

    notificar.sucesso('Bem-vindo de volta!')
    navegar(destino, { replace: true })
  }

  const nome = configuracoes?.nome_negocio
  const logo = configuracoes?.logo_url

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ---------------- Coluna do formulário ---------------- */}
      <div className="flex items-center justify-center bg-superficie px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-9 flex flex-col items-start gap-4">
            {logo ? (
              <img src={logo} alt={nome ?? ''} className="h-11 max-w-[13rem] object-contain" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-destaque">
                <Building2 className="size-6 text-destaque-contraste" strokeWidth={1.9} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-texto">
                Acesse o painel
              </h1>
              {carregandoConfig ? (
                <Skeleton className="h-4 w-52" />
              ) : (
                <p className="text-sm text-texto-suave">
                  Gestão de imóveis, visitas e leads {nome ? `da ${nome}` : ''}.
                </p>
              )}
            </div>
          </div>

          <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@imobiliaria.com.br"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(erro)}
                disabled={entrando}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={senhaVisivel ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={Boolean(erro)}
                  disabled={entrando}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setSenhaVisivel((v) => !v)}
                  aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-texto-tenue transition-colors hover:text-texto"
                >
                  {senhaVisivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {erro && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destrutivo/25 bg-destrutivo/6 px-3.5 py-3"
              >
                <AlertCircle className="mt-px size-4 shrink-0 text-destrutivo" />
                <p className="text-sm text-destrutivo">{erro}</p>
              </div>
            )}

            <Button type="submit" tamanho="grande" disabled={entrando} className="mt-1 w-full">
              {entrando && <Loader2 className="size-4 animate-spin" />}
              {entrando ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          {/* Não existe cadastro nem recuperação de senha por link público:
              usuários são criados pelo desenvolvedor no Supabase.
              Ver README.md, "Criando o primeiro usuário do painel". */}
          <p className="mt-8 text-xs leading-relaxed text-texto-tenue">
            O acesso ao painel é criado pela administração do sistema. Se você não consegue
            entrar, procure o responsável pela imobiliária.
          </p>
        </div>
      </div>

      {/* ---------------- Coluna visual ---------------- */}
      <div className="relative hidden overflow-hidden bg-destaque lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 22% 18%, white 0, transparent 42%), radial-gradient(circle at 82% 78%, white 0, transparent 46%)',
          }}
        />
        {/* Malha de planta baixa, discreta o bastante para não competir
            com os cartões que ficam por cima. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-[26rem] rounded-full border border-white/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 size-[30rem] rounded-full border border-white/10"
        />

        <div className="relative flex h-full flex-col justify-between gap-10 p-14">
          <div className="flex items-center gap-2.5 text-destaque-contraste/70">
            <KeyRound className="size-4" strokeWidth={1.9} />
            <span className="text-xs font-medium uppercase tracking-[0.16em]">
              Painel de gestão
            </span>
          </div>

          <ul className="grid max-w-xl grid-cols-2 gap-3.5">
            {AREAS.map(({ icone: Icone, titulo, apoio }) => (
              <li
                key={titulo}
                className="rounded-xl border border-white/12 bg-white/8 p-4 backdrop-blur-[2px]"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/12 text-destaque-contraste">
                  <Icone className="size-5" strokeWidth={1.8} />
                </span>
                <p className="mt-3 text-sm font-medium text-destaque-contraste">{titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-destaque-contraste/65">
                  {apoio}
                </p>
              </li>
            ))}
          </ul>

          <div>
            {carregandoConfig ? (
              <Skeleton className="h-10 w-72 bg-white/20" />
            ) : (
              <p className="max-w-lg text-4xl font-semibold leading-tight tracking-tight text-destaque-contraste">
                {nomeNegocio}
              </p>
            )}
            <p className="mt-4 max-w-md text-base leading-relaxed text-destaque-contraste/75">
              Sua carteira de imóveis, a agenda dos corretores e o funil de atendimento no
              mesmo lugar. A vitrine fica sempre em dia, sem publicação manual.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
