import { supabase } from '@/lib/supabase'

/**
 * Rastreamento próprio de tráfego da vitrine.
 *
 * Existe para não depender de ferramenta externa: o dashboard da Etapa 7
 * responde "qual imóvel é mais visto" e "qual faz o telefone tocar" com
 * dados do próprio banco, sem script de terceiro, sem banner de cookie e
 * sem enviar o comportamento do visitante para fora.
 *
 * Três princípios, nesta ordem de prioridade:
 *
 * 1. **Nunca bloquear.** Nenhuma função daqui é esperada por render nem
 *    por navegação. Todas engolem o próprio erro.
 * 2. **Nenhum dado pessoal.** O identificador de sessão é aleatório e
 *    não é derivado de nada do visitante. Ver `idDaSessao`.
 * 3. **Só visitante de verdade.** Acesso da equipe pelo painel não entra
 *    na conta. Ver `ehVisitanteReal`.
 */

const CHAVE_SESSAO = 'imobflow:sessao'

/**
 * Identificador anônimo da sessão de navegação.
 *
 * **Serve a um propósito só: alimentar a deduplicação do trigger 10.**
 * O trigger só incrementa `total_visualizacoes` quando não existe
 * visualização anterior daquela sessão para aquele imóvel — sem isso,
 * cada F5 vira visualização nova e o ranking de mais vistos passa a
 * medir quem recarregou a página.
 *
 * É um UUID aleatório, sem nada derivado do visitante: não há
 * impressão digital de navegador, não há IP, não há nada que identifique
 * pessoa. Não dá para ligar duas sessões da mesma pessoa, e é essa a
 * intenção.
 *
 * Fica em `sessionStorage`, e não em `localStorage`: a deduplicação
 * precisa valer durante a visita, não para sempre. Quem volta amanhã com
 * interesse renovado é visita nova, e faz sentido que conte de novo.
 */
export function idDaSessao(): string | null {
  try {
    const guardado = sessionStorage.getItem(CHAVE_SESSAO)
    if (guardado) return guardado

    const novo = crypto.randomUUID()
    sessionStorage.setItem(CHAVE_SESSAO, novo)
    return novo
  } catch {
    // Navegação anônima com armazenamento bloqueado. Sem sessão a
    // visualização ainda é registrada; ela só não deduplica.
    return null
  }
}

/**
 * Decide se este acesso conta como visita.
 *
 * Acesso da equipe não conta. O caminho óbvio é o link "Ver site" da
 * sidebar, mas o problema é maior do que ele: o operador que deixa a
 * vitrine aberta numa aba enquanto trabalha inflaria sozinho o ranking
 * de imóveis mais vistos — e o ranking existe para dizer o que o
 * *cliente* procura.
 *
 * Por isso o critério é a sessão autenticada, e não a origem do clique:
 * quem tem sessão do painel é a equipe, tenha chegado por onde tiver
 * chegado. Um parâmetro na URL seria contornado no primeiro F5.
 */
async function ehVisitanteReal(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session === null
  } catch {
    // Sem conseguir decidir, registra. Perder o dado do visitante real é
    // pior do que contar uma visita da equipe.
    return true
  }
}

interface Evento {
  tipo: 'visualizacao' | 'clique_whatsapp'
  pagina: string
  idImovel?: string | null
  codigoImovel?: string | null
}

/**
 * Grava o evento.
 *
 * Sempre `void`, sempre silenciosa. Rastreamento que derruba a página
 * ou atrasa a renderização custa mais do que o dado que coleta.
 */
async function registrar({ tipo, pagina, idImovel, codigoImovel }: Evento): Promise<void> {
  try {
    if (!(await ehVisitanteReal())) return

    await supabase.from('visualizacoes_site').insert({
      tipo_evento: tipo,
      pagina,
      id_imovel: idImovel ?? null,
      codigo_imovel: codigoImovel ?? null,
      session_id: idDaSessao(),
      // `document.referrer` é vazio quando o visitante chegou digitando
      // ou por link de WhatsApp — o caso mais comum aqui, e não um erro.
      referrer: document.referrer || null,
      user_agent: navigator.userAgent.slice(0, 500),
    })
  } catch {
    /* silencioso por decisão: ver o comentário do módulo */
  }
}

/** Visualização de página. Chamada a cada navegação da vitrine. */
export function registrarVisualizacao(
  pagina: string,
  imovel?: { id: string; codigo: string } | null,
): void {
  void registrar({
    tipo: 'visualizacao',
    pagina,
    idImovel: imovel?.id,
    codigoImovel: imovel?.codigo,
  })
}

/**
 * Clique no botão de WhatsApp.
 *
 * **O clique nunca espera a gravação.** Este é o evento que vira lead, e
 * segurar a navegação para registrar um contador seria trocar o
 * resultado pela medição do resultado. A função devolve na hora e a
 * escrita segue sozinha.
 *
 * `sendBeacon` seria a ferramenta ideal, mas o insert precisa dos
 * cabeçalhos de autenticação do PostgREST, que o beacon não carrega. Na
 * prática o efeito é equivalente: como o WhatsApp abre em outra aba
 * (`target="_blank"`) ou em outro aplicativo, a página que fez a chamada
 * continua viva e a requisição termina normalmente.
 */
export function registrarCliqueWhatsapp(
  pagina: string,
  imovel?: { id: string; codigo: string } | null,
): void {
  void registrar({
    tipo: 'clique_whatsapp',
    pagina,
    idImovel: imovel?.id,
    codigoImovel: imovel?.codigo,
  })
}
