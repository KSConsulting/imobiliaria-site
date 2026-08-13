import { useCallback, useEffect, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { Building2, KeyRound, ScrollText, Shapes } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import { Select } from '@/componentes/ui/select'
import { AbaDados } from '@/componentes/configuracoes/AbaDados'
import { AbaTipos } from '@/componentes/configuracoes/AbaTipos'
import { AbaApi } from '@/componentes/configuracoes/AbaApi'
import { AbaLogs } from '@/componentes/configuracoes/AbaLogs'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import { FUSO_PADRAO } from '@/lib/datas'
import { cn } from '@/lib/utils'

type ChaveAba = 'dados' | 'tipos' | 'api' | 'logs'

const ABAS: { chave: ChaveAba; rotulo: string; icone: LucideIcon }[] = [
  { chave: 'dados', rotulo: 'Dados da imobiliária', icone: Building2 },
  { chave: 'tipos', rotulo: 'Tipos de imóvel', icone: Shapes },
  { chave: 'api', rotulo: 'API', icone: KeyRound },
  { chave: 'logs', rotulo: 'Logs', icone: ScrollText },
]

const PADRAO: ChaveAba = 'dados'

/**
 * Configurações — a tela que torna o sistema implantável sem código.
 *
 * O que é salvo aqui alimenta **três destinos ao mesmo tempo**: o painel,
 * o site público e a API que o agente de IA consome. Não existe
 * publicação: salvar já muda a vitrine.
 *
 * As quatro abas vivem na URL, então um link leva direto à aba certa —
 * o que importa principalmente para os Logs, a aba que alguém abre
 * porque foi mandado conferir alguma coisa lá.
 */
export function Configuracoes() {
  const { configuracoes } = usarConfiguracoes()
  const fuso = configuracoes?.fuso_horario ?? FUSO_PADRAO

  const [parametros, definirParametros] = useSearchParams()
  const aba = normalizar(parametros.get('aba'))

  /**
   * A aba de Dados tem formulário longo e avisa antes de perder o
   * trabalho. As outras três gravam a cada ação e não têm o que perder.
   */
  const [sujo, setSujo] = useState(false)
  const [abaPendente, setAbaPendente] = useState<ChaveAba | null>(null)

  const trocarAba = useCallback(
    (nova: ChaveAba) => {
      definirParametros(
        (anterior) => {
          const proximo = new URLSearchParams(anterior)
          if (nova === PADRAO) proximo.delete('aba')
          else proximo.set('aba', nova)
          return proximo
        },
        { replace: true },
      )
    },
    [definirParametros],
  )

  function pedirTroca(nova: ChaveAba) {
    if (nova === aba) return
    // Trocar de aba desmonta o formulário, e desmontar descarta o que
    // foi digitado. Do ponto de vista de quem preencheu, é a mesma perda
    // de sair da página — então o aviso é o mesmo.
    if (sujo) {
      setAbaPendente(nova)
      return
    }
    trocarAba(nova)
  }

  function confirmarTroca() {
    if (!abaPendente) return
    setSujo(false)
    trocarAba(abaPendente)
    setAbaPendente(null)
  }

  /* ------------------------------------------------ saída da página -- */
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!sujo) return
    const aviso = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="titulo-pagina">Configurações</h2>
        <p className="texto-apoio max-w-3xl">
          O que está aqui alimenta o painel, o site público e a API do agente de IA ao mesmo
          tempo. Não existe publicação: salvar já muda a vitrine.
        </p>
      </div>

      {/* Abas no desktop, seletor no mobile — quatro rótulos longos não
          cabem lado a lado em 375px sem virar rolagem horizontal. */}
      <div className="lg:hidden">
        <Select
          value={aba}
          onChange={(e) => pedirTroca(e.target.value as ChaveAba)}
          aria-label="Seção das configurações"
        >
          {ABAS.map(({ chave, rotulo }) => (
            <option key={chave} value={chave}>
              {rotulo}
            </option>
          ))}
        </Select>
      </div>

      <div className="hidden items-center gap-1 border-b border-borda lg:flex" role="tablist">
        {ABAS.map(({ chave, rotulo, icone: Icone }) => {
          const ativa = aba === chave
          return (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => pedirTroca(chave)}
              className={cn(
                '-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                ativa
                  ? 'border-destaque text-destaque'
                  : 'border-transparent text-texto-suave hover:text-texto',
              )}
            >
              <Icone className="size-4" />
              {rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'dados' && <AbaDados aoMudarSujo={setSujo} />}
      {aba === 'tipos' && <AbaTipos />}
      {aba === 'api' && <AbaApi fuso={fuso} />}
      {aba === 'logs' && <AbaLogs fuso={fuso} />}

      <AvisoAlteracoes
        aberto={Boolean(abaPendente) || bloqueio.state === 'blocked'}
        aoContinuarEditando={() => {
          setAbaPendente(null)
          if (bloqueio.state === 'blocked') bloqueio.reset()
        }}
        aoSair={() => {
          if (abaPendente) {
            confirmarTroca()
            return
          }
          setSujo(false)
          if (bloqueio.state === 'blocked') bloqueio.proceed()
        }}
      />
    </div>
  )
}

function normalizar(valor: string | null): ChaveAba {
  return ABAS.some((aba) => aba.chave === valor) ? (valor as ChaveAba) : PADRAO
}

function AvisoAlteracoes({
  aberto,
  aoContinuarEditando,
  aoSair,
}: {
  aberto: boolean
  aoContinuarEditando: () => void
  aoSair: () => void
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(v) => !v && aoContinuarEditando()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem alterações não salvas</AlertDialogTitle>
          <AlertDialogDescription>
            Os dados que você alterou ainda não foram gravados. Se sair agora, eles se perdem — e
            o site público continua exibindo os valores antigos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variante="secundario" onClick={aoContinuarEditando}>
            Continuar editando
          </Button>
          <Button variante="destrutivo" onClick={aoSair}>
            Sair sem salvar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
