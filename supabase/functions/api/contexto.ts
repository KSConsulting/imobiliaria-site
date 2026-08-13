import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'
import { erro, sucesso } from '../_compartilhado/respostas.ts'
import { porExtenso } from '../_compartilhado/datas.ts'
import { AcoesApi, registrar } from '../_compartilhado/registro.ts'
import { fusoDaImobiliaria } from '../_compartilhado/configuracoes.ts'
import { normalizarWhatsapp } from '../_compartilhado/telefone.ts'
import type { Consumidor } from '../_compartilhado/autenticacao.ts'

/* ------------------------------------------------------------------ */
/* GET /leads/:whatsapp                                                */
/* ------------------------------------------------------------------ */

/**
 * O único endpoint de lead, e é de leitura.
 *
 * **A API não expõe escrita em leads.** Criar e atualizar lead — inclusive
 * mudar o status — é o agente escrevendo direto nas tabelas a partir do
 * N8N. A implicação de segurança disso está registrada em CLAUDE.md e no
 * README: a credencial usada ali ignora o RLS e vive fora do backend.
 *
 * Este endpoint existe para o agente **retomar** uma conversa sabendo o
 * que já aconteceu, em vez de recomeçar o atendimento do zero com alguém
 * que já visitou dois imóveis na semana passada.
 */
export async function leadPorWhatsapp(
  supabase: SupabaseClient,
  consumidor: Consumidor,
  bruto: string,
): Promise<Response> {
  const whatsapp = normalizarWhatsapp(bruto)

  if (!whatsapp) {
    return erro('parametro_invalido', 'Preciso do WhatsApp com DDD, só números.')
  }

  const { data: lead, error } = await supabase
    .from('crm_imobiliaria')
    .select(
      'id, whatsapp, nome, email, status, tipo, origem, codigo_imovel_interesse, finalidade_interesse, tipo_imovel_interesse, faixa_valor_min, faixa_valor_max, motivo_contato, resumo_conversa, observacoes, inicio_atendimento, ultima_mensagem, created_at',
    )
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (error) throw error

  if (!lead) {
    return erro(
      'lead_nao_encontrado',
      'Esse contato ainda não está cadastrado. É um primeiro atendimento.',
    )
  }

  const fuso = await fusoDaImobiliaria(supabase)

  const { data: visitas } = await supabase
    .from('agendamentos')
    .select('id, data_hora_inicio, status, codigo_imovel, imoveis ( codigo, titulo ), corretores ( nome )')
    .eq('id_lead', lead.id)
    .order('data_hora_inicio', { ascending: false })
    .limit(20)

  const historico = (visitas ?? []).map((linha) => {
    const v = linha as unknown as {
      id: string
      data_hora_inicio: string
      status: string
      codigo_imovel: string | null
      imoveis: { codigo: string; titulo: string } | null
      corretores: { nome: string } | null
    }
    return {
      id_agendamento: v.id,
      quando: porExtenso(new Date(v.data_hora_inicio), fuso),
      data: v.data_hora_inicio,
      status: v.status,
      codigo_imovel: v.imoveis?.codigo ?? v.codigo_imovel,
      imovel: v.imoveis?.titulo ?? null,
      corretor: v.corretores?.nome ?? null,
    }
  })

  await registrar(supabase, consumidor, {
    acao: AcoesApi.leadConsultado,
    tabela: 'crm_imobiliaria',
    idRegistro: lead.id,
    dadosNovos: { whatsapp },
  })

  const agendadas = historico.filter((v) => v.status === 'agendada')
  const realizadas = historico.filter((v) => v.status === 'realizada')

  const partes: string[] = [lead.nome ? `${lead.nome} já é conhecido` : 'Contato já cadastrado']
  if (realizadas.length) {
    partes.push(`já ${realizadas.length === 1 ? 'fez 1 visita' : `fez ${realizadas.length} visitas`}`)
  }
  if (agendadas.length) partes.push(`tem visita marcada para ${agendadas[0].quando}`)

  return sucesso({ ...lead, visitas: historico }, `${partes.join(', ')}.`)
}
