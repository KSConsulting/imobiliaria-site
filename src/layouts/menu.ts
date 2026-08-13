import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Columns3,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface ItemMenu {
  rotulo: string
  para: string
  icone: LucideIcon
  /** Rota que só fica ativa em correspondência exata (o Dashboard). */
  exato?: boolean
  /** Etapa em que a tela é construída. Usado nos placeholders. */
  etapa: number
}

export interface GrupoMenu {
  rotulo: string
  itens: ItemMenu[]
}

/**
 * Menu da sidebar, agrupado por contexto de uso.
 *
 * Sete itens em lista corrida obrigam o usuário a ler todos para achar
 * um. Agrupados, ele identifica primeiro o bloco e depois o item.
 *
 * Sobre Leads e Funil: são a MESMA tabela (`crm_imobiliaria`) em duas
 * visualizações — lista com filtros e Kanban por status. Os rótulos
 * nomeiam a visualização, e não o conceito, justamente para eliminar a
 * dúvida de qual abrir.
 */
export const GRUPOS_MENU: GrupoMenu[] = [
  {
    rotulo: 'Visão geral',
    itens: [
      { rotulo: 'Dashboard', para: '/painel', icone: LayoutDashboard, exato: true, etapa: 7 },
    ],
  },
  {
    rotulo: 'Vitrine',
    itens: [{ rotulo: 'Imóveis', para: '/painel/imoveis', icone: Building2, etapa: 3 }],
  },
  {
    rotulo: 'Atendimento',
    itens: [
      { rotulo: 'Leads', para: '/painel/leads', icone: Users, etapa: 5 },
      { rotulo: 'Funil', para: '/painel/funil', icone: Columns3, etapa: 5 },
      { rotulo: 'Agenda', para: '/painel/agenda', icone: CalendarDays, etapa: 4 },
    ],
  },
  {
    rotulo: 'Cadastros',
    itens: [{ rotulo: 'Corretores', para: '/painel/corretores', icone: BadgeCheck, etapa: 4 }],
  },
  {
    rotulo: 'Sistema',
    itens: [
      { rotulo: 'Configurações', para: '/painel/configuracoes', icone: Settings, etapa: 8 },
    ],
  },
]

const TODOS_ITENS = GRUPOS_MENU.flatMap((grupo) => grupo.itens)

/**
 * Título da rota atual.
 *
 * Fonte única para o header do painel e para o título da aba — se cada
 * um derivasse o seu, eles divergiriam na primeira renomeação.
 */
/** Títulos das telas que não são itens de menu, como os formulários. */
const TITULOS_EXTRAS: [RegExp, string][] = [
  [/^\/painel\/imoveis\/novo$/, 'Novo imóvel'],
  [/^\/painel\/imoveis\/[^/]+\/editar$/, 'Editar imóvel'],
]

export function tituloDaRota(caminho: string): string {
  const extra = TITULOS_EXTRAS.find(([padrao]) => padrao.test(caminho))
  if (extra) return extra[1]

  const exato = TODOS_ITENS.find((item) => item.para === caminho)
  if (exato) return exato.rotulo

  const porPrefixo = TODOS_ITENS.filter((item) => item.para !== '/painel')
    .filter((item) => caminho.startsWith(item.para))
    .sort((a, b) => b.para.length - a.para.length)[0]

  return porPrefixo?.rotulo ?? 'Painel'
}
