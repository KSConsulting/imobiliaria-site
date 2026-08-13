import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, Globe, LayoutDashboard, Workflow } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { FaixaIndicadores } from '@/componentes/dashboard/FaixaIndicadores'
import { SeletorPeriodo } from '@/componentes/dashboard/SeletorPeriodo'
import { AbaSite } from '@/componentes/dashboard/AbaSite'
import { AbaOperacao } from '@/componentes/dashboard/AbaOperacao'
import { usarBloco } from '@/ganchos/usarBloco'
import { usarTituloPagina } from '@/ganchos/usarTituloPagina'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import {
  buscarIndicadores,
  montarPeriodo,
  PERIODO_PADRAO,
  verificarDados,
  type ChavePeriodo,
} from '@/lib/dashboard'
import { FUSO_PADRAO } from '@/lib/datas'
import { cn } from '@/lib/utils'

type Aba = 'site' | 'operacao'

const ABAS: { chave: Aba; rotulo: string; icone: typeof Globe; descricao: string }[] = [
  { chave: 'site', rotulo: 'Site', icone: Globe, descricao: 'O site está funcionando?' },
  {
    chave: 'operacao',
    rotulo: 'Operação',
    icone: Workflow,
    descricao: 'A operação está funcionando?',
  },
]

/**
 * Dashboard — a primeira tela depois do login.
 *
 * Responde a duas perguntas diferentes: **"meu site está funcionando?"**
 * e **"minha operação está funcionando?"**. Por isso é uma página com
 * abas, e não duas páginas no menu.
 *
 * Separadas no menu, o dono precisaria lembrar em qual delas mora cada
 * número e acabaria abrindo só uma. Numa tela corrida, virariam treze
 * cartões empilhados e ninguém leria até o fim. Com abas, os quatro
 * números que ele sempre quer ficam fixos no topo e o aprofundamento é
 * escolhido.
 */
export function Dashboard() {
  const { configuracoes } = usarConfiguracoes()
  const fuso = configuracoes?.fuso_horario ?? FUSO_PADRAO

  const [parametros, definirParametros] = useSearchParams()
  usarTituloPagina('Dashboard')

  const chavePeriodo = (parametros.get('periodo') ?? PERIODO_PADRAO) as ChavePeriodo
  const de = parametros.get('de') ?? ''
  const ate = parametros.get('ate') ?? ''
  const aba: Aba = parametros.get('aba') === 'operacao' ? 'operacao' : 'site'

  const periodo = useMemo(
    () => montarPeriodo(chavePeriodo, fuso, de, ate),
    [chavePeriodo, fuso, de, ate],
  )

  const atualizar = useCallback(
    (valores: Record<string, string>) => {
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

  // A faixa fixa é o primeiro bloco a disparar: é ela que precisa
  // aparecer antes de tudo, porque define a percepção de velocidade do
  // sistema inteiro.
  const indicadores = usarBloco(
    () => buscarIndicadores(periodo),
    [periodo.inicio, periodo.fim, periodo.inicioAnterior, periodo.fimAnterior],
  )

  const existencia = usarBloco(() => verificarDados(), [])

  const sistemaVazio =
    existencia.dados !== null &&
    !existencia.dados.tem_imoveis &&
    !existencia.dados.tem_leads &&
    !existencia.dados.tem_visitas &&
    !existencia.dados.tem_trafego

  if (existencia.carregando) {
    return <EstadoCarregando mensagem="Carregando o painel…" />
  }

  if (sistemaVazio) return <SistemaRecemImplantado />

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Cabeçalho e período ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="titulo-pagina">Dashboard</h2>
          <p className="texto-apoio">
            Tudo daqui vem do banco do próprio sistema — sem ferramenta externa de análise.
          </p>
        </div>

        <SeletorPeriodo
          chave={chavePeriodo}
          de={de}
          ate={ate}
          periodo={periodo}
          aoMudarChave={(nova) =>
            atualizar({
              periodo: nova === PERIODO_PADRAO ? '' : nova,
              // Sair do personalizado descarta as datas: mantidas na
              // URL, voltariam sozinhas ao escolher personalizado de
              // novo, com um recorte que o usuário já tinha abandonado.
              ...(nova === 'personalizado' ? {} : { de: '', ate: '' }),
            })
          }
          aoMudarDatas={(novoDe, novoAte) => atualizar({ de: novoDe, ate: novoAte })}
        />
      </div>

      {/* ---------------- Faixa fixa ---------------- */}
      <FaixaIndicadores
        dados={indicadores.dados}
        carregando={indicadores.carregando}
        rotuloPeriodo={periodo.rotulo}
      />

      {/* ---------------- Abas ---------------- */}
      <div className="flex items-center gap-1 border-b border-borda" role="tablist">
        {ABAS.map(({ chave, rotulo, icone: Icone, descricao }) => {
          const ativa = aba === chave
          return (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={ativa}
              title={descricao}
              onClick={() => atualizar({ aba: chave === 'site' ? '' : chave })}
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

      {/* Só a aba visível monta e consulta. A outra dispara as consultas
          dela quando for aberta — não faz sentido pagar por sete
          agregações que talvez ninguém veja. */}
      {aba === 'site' ? <AbaSite periodo={periodo} /> : <AbaOperacao periodo={periodo} />}
    </div>
  )
}

/**
 * Sistema recém-implantado.
 *
 * Uma página inteira de zeros parece defeito: o dono conclui que o
 * sistema não está funcionando, quando na verdade ainda não há o que
 * medir. Melhor dizer isso com todas as letras e apontar o primeiro
 * passo — que é sempre o mesmo, cadastrar imóvel.
 */
function SistemaRecemImplantado() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="titulo-pagina">Dashboard</h2>
        <p className="texto-apoio">Os números aparecem aqui assim que houver o que medir.</p>
      </div>

      <div className="cartao flex flex-col items-center px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-destaque-suave">
          <LayoutDashboard className="size-7 text-destaque" strokeWidth={1.7} />
        </span>

        <h3 className="mt-6 text-xl font-semibold text-texto">
          Ainda não há dados para exibir
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-texto-suave">
          Não é um erro: o sistema acabou de ser implantado e ainda não registrou imóveis, leads
          nem acessos ao site. Assim que o primeiro imóvel for publicado, esta tela passa a
          mostrar visitas, cliques no WhatsApp e a evolução do funil.
        </p>

        <ol className="mt-9 flex w-full max-w-md flex-col gap-3 text-left">
          <Passo numero={1} titulo="Cadastre o primeiro imóvel">
            Ele aparece na vitrine no mesmo instante, sem publicação manual.
          </Passo>
          <Passo numero={2} titulo="Divulgue o link do site">
            Cada acesso e cada clique no WhatsApp passam a ser registrados aqui.
          </Passo>
          <Passo numero={3} titulo="Cadastre a equipe">
            Sem corretor cadastrado não há janela de atendimento, e sem janela não há horário para
            oferecer.
          </Passo>
        </ol>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/painel/imoveis/novo">
              <Building2 className="size-4" />
              Cadastrar primeiro imóvel
            </Link>
          </Button>
          <Button asChild variante="secundario">
            <a href="/" target="_blank" rel="noreferrer">
              <Globe className="size-4" />
              Ver o site
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3.5 rounded-xl border border-borda px-4 py-3.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-superficie-alternativa text-sm font-bold text-texto-suave">
        {numero}
      </span>
      <span>
        <span className="block text-sm font-semibold text-texto">{titulo}</span>
        <span className="block text-sm leading-relaxed text-texto-suave">{children}</span>
      </span>
    </li>
  )
}
