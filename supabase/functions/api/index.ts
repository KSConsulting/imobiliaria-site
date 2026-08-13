import { clienteAdmin } from '../_compartilhado/ambiente.ts'
import { autenticar, ehResposta } from '../_compartilhado/autenticacao.ts'
import { erro, preflight, json } from '../_compartilhado/respostas.ts'
import {
  buscarImoveis,
  imoveisPorCodigos,
  imovelPorCodigo,
  listarPorStatus,
} from './imoveis.ts'
import { agendar, cancelar, disponibilidade, listarVisitas, reagendar } from './agenda.ts'
import { leadPorWhatsapp } from './contexto.ts'

/**
 * API pública do ImobFlow.
 *
 * **Uma função só, com roteamento interno**, em vez de uma função por
 * endpoint. Autenticação, limite de requisições, formato de resposta e
 * trilha de auditoria são idênticos em todos: separá-los em dez deploys
 * significaria dez cópias dessa camada, e a primeira que alguém
 * esquecesse de atualizar viraria um endpoint sem limite de requisições
 * que ninguém notaria.
 *
 * **`verify_jwt` é `false` nesta função** (ver `supabase/config.toml`), e
 * precisa ser. O gateway do Supabase, com ele ligado, exigiria um JWT do
 * Supabase Auth no `Authorization` — e o que vai ali é o token do
 * ImobFlow, validado contra `api_tokens`. Desligar não abre a porta: só
 * transfere a tranca do gateway para `autenticar()`, que é a primeira
 * coisa que roda em toda requisição.
 */

const PREFIXO = /^\/(api|imobflow-api)/

Deno.serve(async (requisicao: Request): Promise<Response> => {
  if (requisicao.method === 'OPTIONS') return preflight()

  const url = new URL(requisicao.url)
  const caminho = url.pathname.replace(PREFIXO, '').replace(/\/+$/, '') || '/'
  const partes = caminho.split('/').filter(Boolean)

  let supabase
  try {
    supabase = clienteAdmin()
  } catch (falha) {
    console.error('[api] ambiente incompleto:', falha)
    return erro('erro_interno', 'A API não está configurada corretamente.')
  }

  // Nada acontece antes disto. Rota inexistente também só responde
  // depois de autenticar: a lista de endpoints válidos é informação, e
  // não há razão para entregá-la a quem não tem token.
  const consumidor = await autenticar(requisicao, supabase)
  if (ehResposta(consumidor)) return consumidor

  try {
    const corpo = await lerCorpo(requisicao)
    const metodo = requisicao.method

    /* ------------------------------------------------ imóveis ----- */
    if (partes[0] === 'imoveis') {
      // `/imoveis/buscar` é o endpoint de imóveis. Com `codigos` no
      // corpo responde por código, sem eles procura por características.
      if (metodo === 'POST' && partes[1] === 'buscar') {
        return await buscarImoveis(supabase, consumidor, corpo)
      }

      /* ---------------------------------------------- herdadas ---- *
       * As duas rotas abaixo foram absorvidas por `/imoveis/buscar` e
       * saíram do catálogo, mas continuam respondendo.
       *
       * **Elas estão em produção neste instante.** Apagá-las junto com
       * a fusão quebraria o atendimento no segundo do deploy, antes de
       * o fluxo do N8N poder ser ajustado. Saem quando o fluxo estiver
       * apontando só para `/imoveis/buscar`.
       *
       * O `GET` mantém o contrato antigo de propósito: devolve **um
       * objeto**, com `disponivel` ao lado do `dados`. Alinhá-lo agora
       * ao formato de lista seria a mesma quebra, só mais difícil de
       * enxergar.
       */
      if (metodo === 'GET' && partes[1] === 'codigo' && partes[2]) {
        return await imovelPorCodigo(supabase, consumidor, decodeURIComponent(partes[2]))
      }
      if (metodo === 'POST' && partes[1] === 'codigos') {
        return await imoveisPorCodigos(supabase, consumidor, corpo)
      }
      if (metodo === 'GET' && partes[1] === 'ativos') {
        return await listarPorStatus(supabase, consumidor, 'ativo', url)
      }
      if (metodo === 'GET' && partes[1] === 'inativos') {
        return await listarPorStatus(supabase, consumidor, 'inativo', url)
      }
    }

    /* ------------------------------------------------- agenda ----- */
    if (partes[0] === 'agenda') {
      if (metodo === 'POST' && partes[1] === 'disponibilidade') {
        return await disponibilidade(supabase, consumidor, corpo)
      }
      if (metodo === 'POST' && partes[1] === 'agendar') {
        return await agendar(supabase, consumidor, corpo)
      }
      if (metodo === 'POST' && partes[1] === 'reagendar') {
        return await reagendar(supabase, consumidor, corpo)
      }
      if (metodo === 'POST' && partes[1] === 'cancelar') {
        return await cancelar(supabase, consumidor, corpo)
      }
      if (metodo === 'GET' && partes[1] === 'visitas') {
        return await listarVisitas(supabase, consumidor, url)
      }
    }

    /* -------------------------------------------------- leads ----- */
    if (metodo === 'GET' && partes[0] === 'leads' && partes[1]) {
      return await leadPorWhatsapp(supabase, consumidor, decodeURIComponent(partes[1]))
    }

    /* ------------------------------------------------- índice ----- */
    if (caminho === '/') {
      return json({ sucesso: true, api: 'ImobFlow', endpoints: ENDPOINTS })
    }

    return erro(
      'rota_desconhecida',
      `Não existe ${metodo} ${caminho} nesta API. Consulte a aba API das Configurações.`,
    )
  } catch (falha) {
    // Nunca devolve a mensagem crua do banco: ela pode conter nome de
    // coluna, de constraint e trecho da consulta, e o destino final desta
    // frase é a tela do celular de um cliente.
    console.error('[api] falha não tratada:', falha)
    return erro('erro_interno', 'Tive um problema aqui. Pode tentar de novo em instantes?')
  }
})

/** Corpo JSON, ou objeto vazio. GET não tem corpo, e isso não é erro. */
async function lerCorpo(requisicao: Request): Promise<Record<string, unknown>> {
  if (requisicao.method === 'GET' || requisicao.method === 'HEAD') return {}
  try {
    const texto = await requisicao.text()
    if (!texto.trim()) return {}
    const valor = JSON.parse(texto)
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}
  } catch {
    return {}
  }
}

/**
 * O índice de `/`. Lista o que é para ser usado, e só.
 *
 * `GET /imoveis/codigo/:codigo` e `POST /imoveis/codigos` continuam
 * respondendo, mas ficam fora daqui: um índice que anuncia três formas
 * de fazer a mesma coisa devolve ao agente exatamente a escolha que a
 * fusão existiu para tirar dele.
 */
const ENDPOINTS = [
  'POST /imoveis/buscar',
  'GET  /imoveis/ativos',
  'GET  /imoveis/inativos',
  'POST /agenda/disponibilidade',
  'POST /agenda/agendar',
  'POST /agenda/reagendar',
  'POST /agenda/cancelar',
  'GET  /agenda/visitas',
  'GET  /leads/:whatsapp',
]
