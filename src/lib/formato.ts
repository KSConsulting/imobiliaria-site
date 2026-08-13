/** Formatação e conversão de valores para o padrão brasileiro. */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MOEDA_CURTA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** R$ 450.000,00 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return MOEDA.format(valor)
}

/** R$ 450.000 — usado nos cards, onde os centavos só poluem. */
export function formatarMoedaCurta(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return Number.isInteger(valor) ? MOEDA_CURTA.format(valor) : MOEDA.format(valor)
}

/** 120,5 m² */
export function formatarArea(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor)} m²`
}

/**
 * Máscara de moeda para digitação.
 *
 * O usuário digita apenas dígitos e o valor cresce da direita para a
 * esquerda, como em caixa eletrônico: "45000" vira "450,00". É o
 * comportamento que não exige do usuário decidir onde fica a vírgula.
 */
export function mascararMoeda(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '')
  if (!digitos) return ''
  const numero = Number(digitos) / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

/** Converte o texto mascarado de volta para número. "450.000,00" → 450000 */
export function moedaParaNumero(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '')
  if (!digitos) return null
  return Number(digitos) / 100
}

/** Converte um número do banco para o texto da máscara. */
export function numeroParaMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

/** Aceita "120,5" ou "120.5" e devolve 120.5. */
export function textoParaNumero(texto: string): number | null {
  const limpo = texto.replace(/\./g, '').replace(',', '.').trim()
  if (!limpo) return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}

/** 01310-100 */
export function mascararCep(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 5) return digitos
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/**
 * Máscara de telefone durante a digitação: (11) 98765-4321
 *
 * Cresce junto com o que foi digitado, em vez de exigir o número
 * completo para formatar. O DDD é separado logo no terceiro dígito
 * porque é onde o erro mais comum aparece — número sem DDD — e ver os
 * parênteses vazios torna a falta óbvia antes de salvar.
 */
export function mascararTelefone(entrada: string): string {
  const d = entrada.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** 1,2 MB */
export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Rótulos de exibição da finalidade. */
export const ROTULOS_FINALIDADE: Record<string, string> = {
  venda: 'Venda',
  locacao: 'Locação',
  ambos: 'Venda e Locação',
}

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const
