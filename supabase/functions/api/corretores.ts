import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { sucesso } from '../_compartilhado/respostas.ts'
import { listar, NOMES_DIAS } from '../_compartilhado/datas.ts'
import { AcoesApi, registrar } from '../_compartilhado/registro.ts'
import type { Consumidor } from '../_compartilhado/autenticacao.ts'

/**
 * GET /corretores — quem atende, e o id da agenda de cada um.
 *
 * **Não é um endpoint de atendimento**, e essa distinção precisa
 * sobreviver: corretor é livre no ImobFlow, qualquer um conduz qualquer
 * visita, e quem decide quem conduz é `/agenda/agendar`, que pega o livre
 * menos carregado. Perguntar "com qual corretor você prefere?" no
 * WhatsApp é uma pergunta que o cliente não tem como responder, e
 * oferecer a lista a ele transforma uma escolha do sistema numa escolha
 * dele.
 *
 * O que ele resolve são os dois casos em que o fluxo precisa do
 * identificador antes de existir uma conversa:
 *
 * - **O `id_corretor`**, que é o filtro de `GET /agenda/visitas` e o
 *   campo opcional de `agendar` e `reagendar`. Sem esta lista, o único
 *   jeito de descobri-lo é ler o banco por fora.
 * - **O `id_agenda`**, que não é usado por endpoint nenhum desta API. Ele
 *   é a chave de `agendas_horarios`, e existe aqui para o fluxo que lê ou
 *   escreve a janela de atendimento direto na tabela pelo N8N.
 *
 * **Dado pessoal do corretor fica de fora, e isso não é esquecimento.**
 * `whatsapp`, `email` e `creci` existem na tabela e não entram na
 * seleção. A Edge Function roda com service role, que ignora todo o RLS:
 * a lista de colunas é a única proteção que sobra, a mesma regra de
 * `proprietario_contato` em `CAMPOS_COMPLETO`. Um `select('*')` aqui
 * colocaria o telefone particular de um funcionário dentro do WhatsApp de
 * qualquer pessoa que perguntasse quem trabalha na imobiliária.
 *
 * **`duracao_slot` também fica de fora**, por outro motivo: a coluna
 * existe em `agendas`, mas quem gera os blocos é `DURACAO_VISITA`, do
 * ambiente. Devolver o valor da tabela prometeria um número que o cálculo
 * de disponibilidade não consulta, e a divergência só apareceria no dia
 * em que alguém editasse a coluna esperando que a agenda mudasse.
 */

interface HorarioBruto {
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

interface CorretorBruto {
  id: string
  nome: string
  sobrenome: string
  ativo: boolean
  agendas: { id: string; agendas_horarios: HorarioBruto[] } | null
}

export async function listarCorretores(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  url: URL,
): Promise<Response> {
  // Inativo é quem saiu da equipe ou está afastado: ele não recebe visita
  // e não deve ser oferecido. Fica atrás de um parâmetro explícito, para
  // o caso de sincronização com sistema externo, e não no caminho normal.
  const incluirInativos = url.searchParams.get('incluir_inativos') === 'true'

  let consulta = supabase
    .from('corretores')
    .select('id, nome, sobrenome, ativo, agendas ( id, agendas_horarios ( dia_semana, hora_inicio, hora_fim, ativo ) )')
    .order('nome')

  if (!incluirInativos) consulta = consulta.eq('ativo', true)

  const { data, error } = await consulta
  if (error) throw error

  const corretores = ((data ?? []) as unknown as CorretorBruto[]).map((bruto) => {
    const horarios = (bruto.agendas?.agendas_horarios ?? [])
      .filter((h) => h.ativo)
      .sort((a, b) => a.dia_semana - b.dia_semana)

    return {
      id_corretor: bruto.id,
      // A agenda é criada por trigger no cadastro do corretor, então na
      // prática nunca falta. Vem opcional mesmo assim: um nulo aqui é
      // legível, e um campo ausente faria o fluxo do N8N quebrar sem
      // dizer o motivo.
      id_agenda: bruto.agendas?.id ?? null,
      nome: bruto.nome,
      sobrenome: bruto.sobrenome,
      nome_completo: `${bruto.nome} ${bruto.sobrenome}`,
      ativo: bruto.ativo,
      atende: resumirJanela(horarios),
      atendimento: horarios.map((h) => ({
        dia_semana: h.dia_semana,
        dia: NOMES_DIAS[h.dia_semana],
        inicio: h.hora_inicio.slice(0, 5),
        fim: h.hora_fim.slice(0, 5),
      })),
    }
  })

  await registrar(supabase, consumidor, {
    acao: AcoesApi.corretoresConsultados,
    tabela: 'corretores',
    dadosNovos: { incluir_inativos: incluirInativos, encontrados: corretores.length },
  })

  const ativos = corretores.filter((c) => c.ativo)

  return sucesso(
    corretores,
    ativos.length === 0
      ? 'Não há nenhum corretor ativo para conduzir visitas no momento.'
      : ativos.length === 1
        ? `Quem conduz as visitas é ${ativos[0].nome}.`
        : `A equipe tem ${ativos.length} corretores: ${listar(ativos.map((c) => c.nome), 'e')}.`,
    { total: corretores.length },
  )
}

/**
 * A janela em uma frase: `"segunda a sexta, das 9h às 18h"`.
 *
 * Mesma regra de agrupamento de `resumirJanela`, em `src/lib/corretores.ts`,
 * portada e não importada — os dois runtimes não compartilham módulos.
 * **Mexeu numa, confira a outra**: é a mesma janela descrita para dois
 * leitores, e duas frases diferentes para o mesmo corretor fazem quem
 * confere o painel duvidar do que o agente respondeu.
 *
 * A diferença de forma é proposital: no painel os dias são abreviados,
 * porque estão num cartão estreito; aqui vão por extenso, porque o
 * destino é a leitura de um modelo, onde "Seg" não economiza nada e
 * "sáb" pode ser lido como outra coisa.
 */
function resumirJanela(horarios: HorarioBruto[]): string {
  if (horarios.length === 0) return 'Sem horário de atendimento definido'

  const grupos: { dias: number[]; inicio: string; fim: string }[] = []
  for (const horario of horarios) {
    const anterior = grupos.at(-1)
    const mesmoHorario =
      anterior && anterior.inicio === horario.hora_inicio && anterior.fim === horario.hora_fim

    if (mesmoHorario) anterior.dias.push(horario.dia_semana)
    else {
      grupos.push({
        dias: [horario.dia_semana],
        inicio: horario.hora_inicio,
        fim: horario.hora_fim,
      })
    }
  }

  return grupos
    .map((g) => `${nomearDias(g.dias)}, das ${horaCurta(g.inicio)} às ${horaCurta(g.fim)}`)
    .join('; ')
}

function nomearDias(dias: number[]): string {
  const nomes = dias.map((d) => NOMES_DIAS[d].replace('-feira', ''))
  if (nomes.length === 1) return nomes[0]

  // Sequência contínua de três ou mais vira intervalo: "segunda a sexta".
  const contiguos = dias.every((dia, i) => i === 0 || dia === dias[i - 1] + 1)
  if (contiguos && nomes.length >= 3) return `${nomes[0]} a ${nomes.at(-1)}`

  return listar(nomes, 'e')
}

/** `"09:00:00"` → `"9h"`, `"09:30:00"` → `"9h30"`. */
function horaCurta(hora: string): string {
  const [h, m] = hora.split(':')
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`
}
