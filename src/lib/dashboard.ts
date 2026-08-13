import { supabase } from '@/lib/supabase'
import { inicioDoDia, inicioDoMes, partesNoFuso, somarDias, instanteDe } from '@/lib/datas'

/**
 * Camada de dados do Dashboard.
 *
 * Cada função aqui é uma chamada a uma função de agregação do Postgres —
 * ver `supabase/migrations/…015_dashboard_agregacoes.sql`. **Nenhuma
 * soma acontece neste arquivo.** Trazer meses de `visualizacoes_site`
 * para o navegador funcionaria na demonstração e travaria no terceiro
 * mês do cliente.
 *
 * As funções são independentes de propósito: a página dispara todas em
 * paralelo e mostra cada bloco assim que ele fica pronto, em vez de
 * esperar a consulta mais lenta para desenhar qualquer coisa.
 */

/* ==================================================================== */
/* Período                                                               */
/* ==================================================================== */

export type ChavePeriodo = '7dias' | '30dias' | 'este-mes' | 'mes-passado' | 'personalizado'

export interface Periodo {
  /** Instante inicial, inclusivo. */
  inicio: Date
  /** Instante final, EXCLUSIVO — meia-noite do dia seguinte ao último. */
  fim: Date
  /** Período anterior equivalente, para a variação percentual. */
  inicioAnterior: Date
  fimAnterior: Date
  rotulo: string
}

export const OPCOES_PERIODO: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: '7dias', rotulo: 'Últimos 7 dias' },
  { chave: '30dias', rotulo: 'Últimos 30 dias' },
  { chave: 'este-mes', rotulo: 'Este mês' },
  { chave: 'mes-passado', rotulo: 'Mês passado' },
  { chave: 'personalizado', rotulo: 'Período personalizado' },
]

export const PERIODO_PADRAO: ChavePeriodo = '30dias'

/**
 * Converte a escolha do seletor em instantes absolutos.
 *
 * Todo o cálculo passa por `src/lib/datas.ts`, no fuso da imobiliária, e
 * não pela hora local do navegador. As funções do banco agrupam por dia
 * usando o mesmo fuso — se as duas pontas discordassem, o total do
 * cartão não bateria com a soma do gráfico logo abaixo dele.
 *
 * **O período anterior é calculado aqui, e não no SQL.** A semântica de
 * "anterior" muda com a opção: para "últimos 30 dias" são os 30 dias
 * imediatamente antes; para "este mês" é o mês passado, que pode ter 28
 * ou 31 dias. Essa regra pertence a quem oferece as opções.
 */
export function montarPeriodo(
  chave: ChavePeriodo,
  fuso: string,
  de?: string,
  ate?: string,
): Periodo {
  const agora = new Date()
  const hoje = inicioDoDia(agora, fuso)

  switch (chave) {
    case '7dias':
      return comAnteriorDeslocado(
        somarDias(hoje, -6, fuso),
        somarDias(hoje, 1, fuso),
        'Últimos 7 dias',
      )

    case 'este-mes': {
      const inicio = inicioDoMes(agora, fuso)
      const fim = somarDias(hoje, 1, fuso)
      // O anterior é o MÊS PASSADO INTEIRO, não os mesmos dias corridos.
      // No dia 3, comparar 3 dias contra 31 diria "queda de 90%" todo
      // começo de mês, o que não informa nada.
      const p = partesNoFuso(inicio, fuso)
      const inicioAnterior = instanteDe(p.ano, p.mes - 1, 1, 0, 0, fuso)
      return {
        inicio,
        fim,
        inicioAnterior,
        fimAnterior: inicio,
        rotulo: 'Este mês',
      }
    }

    case 'mes-passado': {
      const p = partesNoFuso(agora, fuso)
      const inicio = instanteDe(p.ano, p.mes - 1, 1, 0, 0, fuso)
      const fim = instanteDe(p.ano, p.mes, 1, 0, 0, fuso)
      const inicioAnterior = instanteDe(p.ano, p.mes - 2, 1, 0, 0, fuso)
      return { inicio, fim, inicioAnterior, fimAnterior: inicio, rotulo: 'Mês passado' }
    }

    case 'personalizado': {
      if (de && ate) {
        const [a1, m1, d1] = de.split('-').map(Number)
        const [a2, m2, d2] = ate.split('-').map(Number)
        const inicio = instanteDe(a1, m1, d1, 0, 0, fuso)
        // `ate` é o último dia desejado; o fim exclusivo é o dia seguinte.
        const fim = instanteDe(a2, m2, d2 + 1, 0, 0, fuso)
        return comAnteriorDeslocado(inicio, fim, `${formatarCurto(de)} a ${formatarCurto(ate)}`)
      }
      // Sem as duas datas, cai no padrão em vez de exibir período vazio.
      return montarPeriodo('30dias', fuso)
    }

    case '30dias':
    default:
      return comAnteriorDeslocado(
        somarDias(hoje, -29, fuso),
        somarDias(hoje, 1, fuso),
        'Últimos 30 dias',
      )
  }
}

/** Período anterior de mesma duração, colado antes do início. */
function comAnteriorDeslocado(inicio: Date, fim: Date, rotulo: string): Periodo {
  const duracao = fim.getTime() - inicio.getTime()
  return {
    inicio,
    fim,
    inicioAnterior: new Date(inicio.getTime() - duracao),
    fimAnterior: inicio,
    rotulo,
  }
}

function formatarCurto(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Quantidade de dias do período. Decide a densidade dos gráficos. */
export function diasDoPeriodo(periodo: Periodo): number {
  return Math.max(1, Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / 86_400_000))
}

/* ==================================================================== */
/* Indicadores                                                           */
/* ==================================================================== */

export interface Indicadores {
  leads_novos: number
  leads_novos_anterior: number
  visitas: number
  visitas_anterior: number
  visitas_site: number
  visitas_site_anterior: number
  imoveis_ativos: number
  imoveis_venda: number
  imoveis_locacao: number
}

export async function buscarIndicadores(periodo: Periodo): Promise<Indicadores> {
  const { data, error } = await supabase.rpc('fn_dashboard_indicadores', {
    p_inicio: periodo.inicio.toISOString(),
    p_fim: periodo.fim.toISOString(),
    p_inicio_anterior: periodo.inicioAnterior.toISOString(),
    p_fim_anterior: periodo.fimAnterior.toISOString(),
  })

  if (error) throw error
  return (data?.[0] ?? {
    leads_novos: 0,
    leads_novos_anterior: 0,
    visitas: 0,
    visitas_anterior: 0,
    visitas_site: 0,
    visitas_site_anterior: 0,
    imoveis_ativos: 0,
    imoveis_venda: 0,
    imoveis_locacao: 0,
  }) as Indicadores
}

/**
 * Variação percentual entre o período e o anterior.
 *
 * Devolve `null` quando não havia nada antes. Não é o mesmo que zero:
 * sair de 0 para 12 leads não é "alta de 0%" nem "alta de infinito%" —
 * é a primeira medição, e a interface diz isso com palavras em vez de
 * inventar um número.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/* ==================================================================== */
/* Aba Site                                                              */
/* ==================================================================== */

export interface LinhaRanking {
  id_imovel: string
  codigo: string
  titulo: string
  bairro: string
  cidade: string
  url_capa: string | null
  visualizacoes: number
  cliques: number
  /** Cliques ÷ visualizações, em pontos percentuais. Nulo sem visualização. */
  conversao: number | null
}

export type TipoRanking = 'visualizacao' | 'clique_whatsapp'

export async function buscarRanking(
  periodo: Periodo,
  evento: TipoRanking,
  limite = 10,
): Promise<LinhaRanking[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_ranking_imoveis', {
    p_inicio: periodo.inicio.toISOString(),
    p_fim: periodo.fim.toISOString(),
    p_evento: evento,
    p_limite: limite,
  })

  if (error) throw error
  return (data ?? []) as LinhaRanking[]
}

export interface LinhaPagina {
  pagina: string
  acessos: number
  agregada: boolean
}

export async function buscarPaginas(periodo: Periodo): Promise<LinhaPagina[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_paginas', {
    p_inicio: periodo.inicio.toISOString(),
    p_fim: periodo.fim.toISOString(),
  })

  if (error) throw error
  return (data ?? []) as LinhaPagina[]
}

export interface Estoque {
  ativos: number
  inativos: number
  venda: number
  locacao: number
  ambos: number
  sem_foto: number
}

export async function buscarEstoque(): Promise<Estoque> {
  const { data, error } = await supabase.rpc('fn_dashboard_estoque')
  if (error) throw error
  return (data?.[0] ?? {
    ativos: 0,
    inativos: 0,
    venda: 0,
    locacao: 0,
    ambos: 0,
    sem_foto: 0,
  }) as Estoque
}

export interface LinhaTipo {
  tipo: string
  total: number
}

export async function buscarEstoquePorTipo(): Promise<LinhaTipo[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_estoque_por_tipo')
  if (error) throw error
  return (data ?? []) as LinhaTipo[]
}

/* ==================================================================== */
/* Aba Operação                                                          */
/* ==================================================================== */

export interface PontoDiario {
  dia: string
  leads: number
  atendimentos: number
  visitas: number
}

export async function buscarSerieDiaria(periodo: Periodo): Promise<PontoDiario[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_serie_diaria', {
    p_inicio: periodo.inicio.toISOString(),
    p_fim: periodo.fim.toISOString(),
  })

  if (error) throw error
  return (data ?? []) as PontoDiario[]
}

export interface PontoSemana {
  dia_semana: number
  atendimentos: number
  visitas: number
}

export async function buscarDiaSemana(periodo: Periodo): Promise<PontoSemana[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_dia_semana', {
    p_inicio: periodo.inicio.toISOString(),
    p_fim: periodo.fim.toISOString(),
  })

  if (error) throw error
  return (data ?? []) as PontoSemana[]
}

export interface LinhaStatus {
  status: string
  total: number
}

export async function buscarLeadsPorStatus(): Promise<LinhaStatus[]> {
  const { data, error } = await supabase.rpc('fn_dashboard_leads_por_status')
  if (error) throw error
  return (data ?? []) as LinhaStatus[]
}

/* ==================================================================== */
/* Estado inicial                                                        */
/* ==================================================================== */

export interface TemDados {
  tem_imoveis: boolean
  tem_leads: boolean
  tem_visitas: boolean
  tem_trafego: boolean
}

/**
 * Se existe qualquer dado no sistema.
 *
 * Serve para escolher entre o Dashboard e a tela de implantação
 * recente. Uma página inteira de zeros no primeiro dia parece defeito —
 * o dono conclui que o sistema não está funcionando, quando na verdade
 * ainda não há o que medir.
 */
export async function verificarDados(): Promise<TemDados> {
  const { data, error } = await supabase.rpc('fn_dashboard_tem_dados')
  if (error) throw error
  return (data?.[0] ?? {
    tem_imoveis: false,
    tem_leads: false,
    tem_visitas: false,
    tem_trafego: false,
  }) as TemDados
}

/* ==================================================================== */
/* Formatação                                                            */
/* ==================================================================== */

const NUMERO = new Intl.NumberFormat('pt-BR')

/** 1.284 — separador de milhar brasileiro. */
export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return NUMERO.format(valor)
}

/** 12,4% */
export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined) return '—'
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor)}%`
}
