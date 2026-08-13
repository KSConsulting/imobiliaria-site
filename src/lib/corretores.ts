import { supabase, type Tabelas } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { horaCurta, minutosDeHora, NOMES_DIAS_CURTOS } from '@/lib/datas'

export type Corretor = Tabelas['corretores']['Row']
export type Agenda = Tabelas['agendas']['Row']
export type HorarioAgenda = Tabelas['agendas_horarios']['Row']

export interface CorretorCompleto extends Corretor {
  agendas: (Agenda & { agendas_horarios: HorarioAgenda[] }) | null
  /** Visitas ainda agendadas daqui para frente. Preenchido separadamente. */
  visitasProximas: number
}

/** Linha da janela de atendimento no formulário, uma por dia da semana. */
export interface LinhaJanela {
  diaSemana: number
  ativo: boolean
  horaInicio: string
  horaFim: string
}

export const JANELA_PADRAO_INICIO = '09:00'
export const JANELA_PADRAO_FIM = '18:00'

/** Sete linhas, uma por dia, a partir do que está no banco. */
export function janelaParaFormulario(horarios: HorarioAgenda[]): LinhaJanela[] {
  return Array.from({ length: 7 }, (_, diaSemana) => {
    const doDia = horarios.find((h) => h.dia_semana === diaSemana)
    return {
      diaSemana,
      ativo: doDia?.ativo ?? false,
      horaInicio: (doDia?.hora_inicio ?? JANELA_PADRAO_INICIO).slice(0, 5),
      horaFim: (doDia?.hora_fim ?? JANELA_PADRAO_FIM).slice(0, 5),
    }
  })
}

/**
 * Resumo da janela em linguagem natural.
 *
 * Agrupa dias consecutivos com o mesmo horário: "Seg a sex, 9h às 18h"
 * em vez de cinco repetições. Dias soltos viram lista: "Seg, qua e sex".
 */
export function resumirJanela(horarios: HorarioAgenda[]): string {
  const ativos = horarios
    .filter((h) => h.ativo)
    .sort((a, b) => a.dia_semana - b.dia_semana)

  if (ativos.length === 0) return 'Sem horários definidos'

  const grupos: { dias: number[]; inicio: string; fim: string }[] = []
  for (const horario of ativos) {
    const anterior = grupos.at(-1)
    const mesmoHorario =
      anterior && anterior.inicio === horario.hora_inicio && anterior.fim === horario.hora_fim

    if (mesmoHorario) anterior.dias.push(horario.dia_semana)
    else grupos.push({ dias: [horario.dia_semana], inicio: horario.hora_inicio, fim: horario.hora_fim })
  }

  return grupos
    .map((grupo) => `${nomearDias(grupo.dias)}, ${horaCurta(grupo.inicio)} às ${horaCurta(grupo.fim)}`)
    .join(' · ')
}

function nomearDias(dias: number[]): string {
  const nomes = dias.map((d) => NOMES_DIAS_CURTOS[d])
  if (nomes.length === 1) return nomes[0]

  // Sequência contínua de 3 ou mais vira intervalo: "Seg a sex".
  const contiguos = dias.every((dia, i) => i === 0 || dia === dias[i - 1] + 1)
  if (contiguos && nomes.length >= 3) return `${nomes[0]} a ${nomes.at(-1)}`

  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export async function listarCorretores(): Promise<CorretorCompleto[]> {
  const { data, error } = await supabase
    .from('corretores')
    .select('*, agendas(*, agendas_horarios(*))')
    .order('ativo', { ascending: false })
    .order('nome')

  if (error) throw error

  const corretores = (data ?? []) as unknown as Omit<CorretorCompleto, 'visitasProximas'>[]

  // Uma consulta só para todas as contagens, em vez de uma por corretor.
  const { data: visitas } = await supabase
    .from('agendamentos')
    .select('id_corretor')
    .eq('status', 'agendada')
    .gte('data_hora_inicio', new Date().toISOString())

  const contagem = new Map<string, number>()
  for (const visita of visitas ?? []) {
    contagem.set(visita.id_corretor, (contagem.get(visita.id_corretor) ?? 0) + 1)
  }

  return corretores.map((corretor) => ({
    ...corretor,
    visitasProximas: contagem.get(corretor.id) ?? 0,
  }))
}

/** Apenas os ativos, para os seletores da agenda. */
export async function listarCorretoresAtivos(): Promise<CorretorCompleto[]> {
  const todos = await listarCorretores()
  return todos.filter((corretor) => corretor.ativo)
}

export type DadosCorretor = Pick<
  Tabelas['corretores']['Insert'],
  'nome' | 'sobrenome' | 'whatsapp' | 'email' | 'creci' | 'cor' | 'ativo'
>

/**
 * Cria o corretor.
 *
 * A agenda NÃO é criada aqui. O trigger `trg_corretores_criar_agenda`
 * cuida disso no banco, inserindo a linha em `agendas` com slot de 30
 * minutos e populando `agendas_horarios` com segunda a sexta, 09:00 às
 * 18:00. Duplicar isso no frontend criaria duas agendas para o mesmo
 * corretor — e o UNIQUE em `agendas.id_corretor` faria a segunda falhar.
 */
export async function criarCorretor(dados: DadosCorretor): Promise<Corretor> {
  const { data, error } = await supabase.from('corretores').insert(dados).select().single()
  if (error) throw error

  await registrarLog({
    acao: Acoes.corretorCriado,
    tabela: 'corretores',
    idRegistro: data.id,
    dadosNovos: data,
  })

  return data
}

export async function atualizarCorretor(
  id: string,
  dados: DadosCorretor,
  anterior: Corretor,
): Promise<Corretor> {
  const { data, error } = await supabase
    .from('corretores')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.corretorAtualizado,
    tabela: 'corretores',
    idRegistro: id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  })

  return data
}

/**
 * Grava a janela de atendimento.
 *
 * Substitui as linhas do corretor: apaga as antigas e insere as novas.
 * Reconciliar linha a linha economizaria pouco e abriria espaço para
 * duas linhas do mesmo dia, que a interface não sabe representar.
 *
 * Dias inativos também são gravados, com `ativo = false`, para que o
 * horário configurado sobreviva a um desligamento temporário do dia.
 */
export async function salvarJanela(idAgenda: string, linhas: LinhaJanela[]): Promise<void> {
  const { error: erroApagar } = await supabase
    .from('agendas_horarios')
    .delete()
    .eq('id_agenda', idAgenda)
  if (erroApagar) throw erroApagar

  const { error } = await supabase.from('agendas_horarios').insert(
    linhas.map((linha) => ({
      id_agenda: idAgenda,
      dia_semana: linha.diaSemana,
      hora_inicio: linha.horaInicio,
      hora_fim: linha.horaFim,
      ativo: linha.ativo,
    })),
  )
  if (error) throw error
}

/**
 * Id da agenda do corretor.
 *
 * Existe porque a agenda é criada pelo trigger e não volta no `insert`
 * do corretor: para gravar uma janela personalizada logo no cadastro, é
 * preciso perguntar ao banco qual agenda ele acabou de criar.
 */
export async function buscarIdDaAgenda(idCorretor: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('agendas')
    .select('id')
    .eq('id_corretor', idCorretor)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function alterarStatusCorretor(corretor: Corretor, ativo: boolean) {
  const { data, error } = await supabase
    .from('corretores')
    .update({ ativo })
    .eq('id', corretor.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.corretorAtualizado,
    tabela: 'corretores',
    idRegistro: corretor.id,
    dadosAnteriores: { ativo: corretor.ativo },
    dadosNovos: { ativo, nome: `${corretor.nome} ${corretor.sobrenome}` },
  })

  return data
}

/**
 * Exclui o corretor.
 *
 * A FK `agendamentos.id_corretor` usa ON DELETE RESTRICT: corretor com
 * qualquer visita no histórico não pode ser apagado. Isso é proposital
 * — visita órfã é um compromisso que ninguém sabe de quem era. Quem
 * chama precisa traduzir o erro do banco para a sugestão certa, que é
 * desativar em vez de excluir.
 */
export async function excluirCorretor(corretor: Corretor): Promise<void> {
  await registrarLog({
    acao: Acoes.corretorExcluido,
    tabela: 'corretores',
    idRegistro: corretor.id,
    dadosAnteriores: corretor,
  })

  const { error } = await supabase.from('corretores').delete().eq('id', corretor.id)
  if (error) throw error
}

/** Verdadeiro quando o erro do banco é o RESTRICT da FK de agendamentos. */
export function ehErroDeVinculo(erro: unknown): boolean {
  const mensagem =
    typeof erro === 'object' && erro && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : ''
  const codigo =
    typeof erro === 'object' && erro && 'code' in erro
      ? String((erro as { code: unknown }).code)
      : ''
  return codigo === '23503' || mensagem.includes('agendamentos_id_corretor_fkey')
}

/** Quantas visitas o corretor tem no histórico, de qualquer status. */
export async function contarVisitasDoCorretor(idCorretor: string): Promise<number> {
  const { count, error } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('id_corretor', idCorretor)

  if (error) return 0
  return count ?? 0
}

/* ------------------------------------------------------------------ */
/* Disponibilidade                                                     */
/* ------------------------------------------------------------------ */

/** Janela ativa do corretor naquele dia da semana, se houver. */
export function janelaDoDia(
  corretor: CorretorCompleto,
  diaSemana: number,
): { inicio: number; fim: number } | null {
  const horario = corretor.agendas?.agendas_horarios?.find(
    (h) => h.dia_semana === diaSemana && h.ativo,
  )
  if (!horario) return null
  return { inicio: minutosDeHora(horario.hora_inicio), fim: minutosDeHora(horario.hora_fim) }
}

/** Duração do bloco de visita do corretor. Padrão de 30 minutos. */
export function duracaoSlot(corretor: CorretorCompleto): number {
  return corretor.agendas?.duracao_slot ?? 30
}
