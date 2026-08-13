/**
 * Normalização do WhatsApp, em um lugar só.
 *
 * O formato guardado em `crm_imobiliaria.whatsapp` é E.164 sem o sinal
 * de mais: código do país seguido do número nacional, só dígitos. É o
 * mesmo que o agente de IA grava direto pelo N8N, o mesmo que o painel
 * grava (ver src/lib/telefone.ts) e o mesmo que o wa.me aceita.
 *
 * **Esta regra já viveu em duas cópias**, uma em `agenda.ts` e outra em
 * `contexto.ts`, e foi assim que apareceu o defeito que motivou este
 * arquivo: uma copia foi corrigida, a outra não, e o mesmo telefone
 * passou a achar o lead por um endpoint e não achar pelo outro. Como
 * `whatsapp` é UNIQUE e é a chave natural do lead, divergência aqui não
 * dá erro, dá cadastro duplicado.
 *
 * Qualquer endpoint novo que receba telefone deve importar daqui.
 */
export function normalizarWhatsapp(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const digitos = valor.replace(/\D/g, '')

  // Sem código do país: DDD de 2 dígitos mais assinante de 8 ou 9.
  // Assume Brasil, porque não há como inferir país de um DDD solto.
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`

  // Já em E.164, de qualquer país. O piso de 12 evita tomar um número
  // truncado por internacional.
  if (digitos.length >= 12 && digitos.length <= 15) return digitos

  return null
}
