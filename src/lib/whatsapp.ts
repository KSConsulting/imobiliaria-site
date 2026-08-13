/**
 * Link de WhatsApp da imobiliária.
 *
 * Este arquivo carrega a peça que liga o site ao agente de IA. O que
 * torna o sistema inteiro possível é o **código do imóvel dentro da
 * mensagem**: a primeira coisa que chega no WhatsApp já diz qual imóvel
 * gerou o interesse, então o agente responde sobre aquele imóvel na
 * primeira mensagem, sem precisar perguntar "qual imóvel você viu?".
 *
 * Sem o código, o atendimento começaria com uma pergunta cuja resposta o
 * site já sabia — e é nessa pergunta que o contato esfria.
 */

/**
 * Normaliza para o formato que o `wa.me` espera: só dígitos, com o
 * código do país.
 *
 * **Decide por comprimento, não por prefixo.** DDD 55 existe, é Santa
 * Maria e região no Rio Grande do Sul. Testando `startsWith('55')`, um
 * número como 5533334444 seria tomado por já internacional, não
 * receberia o código, ficaria com 10 dígitos e cairia no corte de 12 do
 * `linkWhatsapp`. O resultado seria o botão de WhatsApp **sumir do site
 * inteiro** numa imobiliária gaúcha, sem erro nenhum aparecer.
 *
 * Mesma regra de `normalizarWhatsapp`, em src/lib/telefone.ts: 10 ou 11
 * dígitos é número nacional e recebe o 55; acima disso já vem com o
 * código do país.
 */
function numeroInternacional(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
}

/**
 * Monta o endereço do WhatsApp com a mensagem já escrita.
 *
 * Devolve `null` quando a imobiliária não cadastrou o número — e aí a
 * interface esconde o botão, em vez de exibir um que não leva a lugar
 * nenhum. Ver as Configurações.
 */
export function linkWhatsapp(numero: string | null | undefined, mensagem: string): string | null {
  if (!numero) return null

  const internacional = numeroInternacional(numero)
  if (internacional.length < 12) return null

  return `https://wa.me/${internacional}?text=${encodeURIComponent(mensagem)}`
}

/**
 * Mensagem de interesse em um imóvel.
 *
 * O formato é uma frase natural, não um código solto: quem recebe é uma
 * pessoa ou um agente conversando como pessoa, e "IMV-0042" sozinho na
 * caixa de entrada parece engano de envio.
 *
 * **O código vem sempre no mesmo lugar e no mesmo formato.** É o que
 * permite ao agente extraí-lo com confiança. Mudar a frase é seguro;
 * tirar o código, não. Ver NICHO.md antes de reescrever.
 */
export function mensagemDeInteresse(codigo: string): string {
  return `Olá! Tenho interesse no imóvel ${codigo}.`
}

/** Mensagem do botão do cabeçalho, sem imóvel específico. */
export const MENSAGEM_GERAL = 'Olá! Gostaria de falar sobre imóveis.'

/** (11) 98765-4321 — para exibir na tela. */
export function formatarTelefone(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  const nacional = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
  }
  return numero
}

/** Normaliza o que o dono digitou nas Configurações em uma URL clicável. */
export function urlExterna(valor: string): string {
  const limpo = valor.trim()
  if (/^https?:\/\//i.test(limpo)) return limpo
  return `https://${limpo.replace(/^\/+/, '')}`
}

/** `@imobiliaria` a partir do que estiver cadastrado (URL ou arroba). */
export function arrobaInstagram(valor: string): string {
  const limpo = valor.trim().replace(/\/+$/, '')
  const doUrl = limpo.match(/instagram\.com\/([^/?#]+)/i)
  const usuario = doUrl ? doUrl[1] : limpo.replace(/^@/, '')
  return `@${usuario}`
}

export function urlInstagram(valor: string): string {
  const limpo = valor.trim().replace(/\/+$/, '')
  if (/instagram\.com/i.test(limpo)) return urlExterna(limpo)
  return `https://instagram.com/${limpo.replace(/^@/, '')}`
}
