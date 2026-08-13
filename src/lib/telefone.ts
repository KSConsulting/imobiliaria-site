/* ====================================================================
   WhatsApp: um formato só, com código do país

   O `whatsapp` é UNIQUE em `crm_imobiliaria` e é a chave natural do
   lead. Dois formatos para o mesmo telefone significam duas linhas para
   a mesma pessoa, e o UNIQUE não pega, porque as strings diferem.

   O formato guardado é o E.164 sem o sinal de mais: código do país
   seguido do número nacional, só dígitos.

     5511971351311   Brasil, DDD 11
     351912345678    Portugal

   É o mesmo formato que o agente de IA grava pelo N8N e o mesmo que o
   link do wa.me aceita, então nada precisa ser convertido no caminho.
   ==================================================================== */

export interface Pais {
  sigla: string
  nome: string
  /** Código do país, só dígitos, sem o mais. */
  ddi: string
  bandeira: string
  /** Dígitos do número nacional, sem o DDI. Vazio significa livre. */
  comprimentos: number[]
  /** Placeholder do campo, no formato local. */
  exemplo: string
}

/**
 * Países oferecidos no seletor.
 *
 * Lista curada, não a ONU inteira: um seletor de 200 linhas transforma
 * o caso comum, que é o Brasil, numa busca. Estão aqui o Brasil, os
 * vizinhos do Mercosul, os destinos de brasileiro no exterior e os
 * países de origem de quem compra imóvel no Brasil.
 *
 * Faltando algum, o item "Outro país" aceita o número completo com o
 * código na frente, então ninguém fica sem cadastrar.
 */
export const PAISES: Pais[] = [
  { sigla: 'BR', nome: 'Brasil', ddi: '55', bandeira: '🇧🇷', comprimentos: [10, 11], exemplo: '11 97135-1311' },
  { sigla: 'PT', nome: 'Portugal', ddi: '351', bandeira: '🇵🇹', comprimentos: [9], exemplo: '912 345 678' },
  { sigla: 'US', nome: 'Estados Unidos e Canadá', ddi: '1', bandeira: '🇺🇸', comprimentos: [10], exemplo: '415 555 0132' },
  { sigla: 'AR', nome: 'Argentina', ddi: '54', bandeira: '🇦🇷', comprimentos: [10, 11], exemplo: '11 2345-6789' },
  { sigla: 'UY', nome: 'Uruguai', ddi: '598', bandeira: '🇺🇾', comprimentos: [8, 9], exemplo: '94 123 456' },
  { sigla: 'PY', nome: 'Paraguai', ddi: '595', bandeira: '🇵🇾', comprimentos: [9], exemplo: '981 234 567' },
  { sigla: 'CL', nome: 'Chile', ddi: '56', bandeira: '🇨🇱', comprimentos: [9], exemplo: '9 6123 4567' },
  { sigla: 'CO', nome: 'Colômbia', ddi: '57', bandeira: '🇨🇴', comprimentos: [10], exemplo: '301 234 5678' },
  { sigla: 'MX', nome: 'México', ddi: '52', bandeira: '🇲🇽', comprimentos: [10], exemplo: '55 1234 5678' },
  { sigla: 'ES', nome: 'Espanha', ddi: '34', bandeira: '🇪🇸', comprimentos: [9], exemplo: '612 345 678' },
  { sigla: 'IT', nome: 'Itália', ddi: '39', bandeira: '🇮🇹', comprimentos: [9, 10], exemplo: '312 345 6789' },
  { sigla: 'FR', nome: 'França', ddi: '33', bandeira: '🇫🇷', comprimentos: [9], exemplo: '612 345 678' },
  { sigla: 'DE', nome: 'Alemanha', ddi: '49', bandeira: '🇩🇪', comprimentos: [10, 11], exemplo: '151 23456789' },
  { sigla: 'GB', nome: 'Reino Unido', ddi: '44', bandeira: '🇬🇧', comprimentos: [10], exemplo: '7400 123456' },
  { sigla: 'JP', nome: 'Japão', ddi: '81', bandeira: '🇯🇵', comprimentos: [10], exemplo: '90 1234 5678' },
  { sigla: 'AO', nome: 'Angola', ddi: '244', bandeira: '🇦🇴', comprimentos: [9], exemplo: '923 456 789' },
  // Sem DDI e sem comprimento fixo: aqui se digita o número inteiro,
  // com o código do país na frente.
  { sigla: 'XX', nome: 'Outro país', ddi: '', bandeira: '🌐', comprimentos: [], exemplo: '5511971351311' },
]

export const BRASIL = PAISES[0]
export const OUTRO_PAIS = PAISES[PAISES.length - 1]

/** Menor e maior número possível em E.164, contando o código do país. */
const MINIMO_E164 = 8
const MAXIMO_E164 = 15

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function paisPorSigla(sigla: string): Pais {
  return PAISES.find((p) => p.sigla === sigla) ?? BRASIL
}

/** Quantos dígitos o campo nacional aceita, para travar a digitação. */
export function limiteDeDigitos(pais: Pais): number {
  return pais.comprimentos.length ? Math.max(...pais.comprimentos) : MAXIMO_E164
}

/**
 * Aceita o que foi digitado no campo nacional, já limitado.
 *
 * Colar o número inteiro com o código na frente é o gesto mais comum de
 * quem copia do WhatsApp, e é o que mais gera cadastro errado: com o
 * Brasil escolhido, "5511971351311" viraria um número de 13 dígitos que
 * nenhum país tem. Quando o começo bate com o DDI do país escolhido e o
 * que sobra tem comprimento válido, o DDI é retirado em silêncio.
 */
export function aceitarDigitados(pais: Pais, digitado: string): string {
  const digitos = apenasDigitos(digitado)

  if (pais.ddi && digitos.startsWith(pais.ddi)) {
    const semDdi = digitos.slice(pais.ddi.length)
    if (pais.comprimentos.includes(semDdi.length)) return semDdi
  }

  return digitos.slice(0, limiteDeDigitos(pais))
}

/** O número como vai para o banco: DDI mais nacional, só dígitos. */
export function montarWhatsapp(pais: Pais, nacional: string): string {
  return `${pais.ddi}${apenasDigitos(nacional)}`
}

/**
 * Valida o número nacional contra o país escolhido.
 *
 * Devolve a mensagem de erro, ou `null` quando está certo. A mensagem
 * diz quantos dígitos faltam ou sobram, em vez de "número inválido":
 * quem digitou errado precisa saber o que corrigir.
 */
export function validarWhatsapp(pais: Pais, nacional: string): string | null {
  const digitos = apenasDigitos(nacional)

  if (!digitos) return 'Informe o número do WhatsApp.'

  if (pais === OUTRO_PAIS || !pais.comprimentos.length) {
    if (digitos.length < MINIMO_E164 || digitos.length > MAXIMO_E164) {
      return `Informe o número com o código do país, entre ${MINIMO_E164} e ${MAXIMO_E164} dígitos.`
    }
    return null
  }

  if (pais.comprimentos.includes(digitos.length)) return null

  const esperado = pais.comprimentos.join(' ou ')
  const faltam = Math.min(...pais.comprimentos) - digitos.length

  if (faltam > 0) {
    return faltam === 1
      ? 'Falta 1 dígito.'
      : `Faltam ${faltam} dígitos. ${pais.nome} usa ${esperado} dígitos com o DDD.`
  }

  const sobram = digitos.length - Math.max(...pais.comprimentos)
  return sobram === 1
    ? 'Sobra 1 dígito.'
    : `Sobram ${sobram} dígitos. ${pais.nome} usa ${esperado} dígitos com o DDD.`
}

/**
 * Quebra o número guardado em país mais nacional, para edição.
 *
 * A ordem da tentativa importa. Um número antigo, gravado sem o código
 * do país, tem 10 ou 11 dígitos e começa por DDD; tentando os DDIs
 * primeiro, "11912345678" casaria com o código 1 dos Estados Unidos,
 * sobrando 10 dígitos, que é exatamente o comprimento de lá. Por isso o
 * caso antigo é resolvido antes, como brasileiro.
 *
 * A regressão que isso cria é conhecida e pequena: um celular dos
 * Estados Unidos gravado corretamente em E.164 também tem 11 dígitos e
 * cairia aqui. Some depois que a migration normaliza o histórico, e o
 * público desta base é brasileiro.
 */
export function separarWhatsapp(guardado: string): { pais: Pais; nacional: string } {
  const digitos = apenasDigitos(guardado)

  if (BRASIL.comprimentos.includes(digitos.length)) {
    return { pais: BRASIL, nacional: digitos }
  }

  const porDdiMaisLongo = [...PAISES]
    .filter((p) => p.ddi)
    .sort((a, b) => b.ddi.length - a.ddi.length)

  for (const pais of porDdiMaisLongo) {
    if (!digitos.startsWith(pais.ddi)) continue
    const nacional = digitos.slice(pais.ddi.length)
    if (pais.comprimentos.includes(nacional.length)) return { pais, nacional }
  }

  return { pais: OUTRO_PAIS, nacional: digitos }
}

/** (11) 97135-1311 no Brasil, +351 912 345 678 fora. */
export function exibirWhatsapp(guardado: string): string {
  const { pais, nacional } = separarWhatsapp(guardado)

  if (pais === BRASIL) {
    if (nacional.length === 11) {
      return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
    }
    if (nacional.length === 10) {
      return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
    }
  }

  if (pais === OUTRO_PAIS) return `+${nacional}`

  return `+${pais.ddi} ${nacional}`
}

/**
 * Número pronto para o wa.me, sempre com o código do país.
 *
 * O registro antigo, sem código, recebe o 55 aqui. Sem isso o link
 * abriria uma conversa com número inexistente.
 */
export function paraLinkWhatsapp(guardado: string): string {
  const { pais, nacional } = separarWhatsapp(guardado)
  return `${pais.ddi || ''}${nacional}`
}
