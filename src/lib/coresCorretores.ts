/**
 * Paleta fixa das cores de corretor.
 *
 * Por que uma paleta fechada, e não um seletor livre: a cor existe para
 * distinguir de relance de quem é cada visita na agenda. Escolhida à
 * mão, a terceira pessoa pega um verde parecido com o da segunda, e a
 * cor deixa de resolver o problema que ela existe para resolver — só
 * que ninguém percebe até a agenda estar cheia.
 *
 * As doze foram escolhidas para se distinguirem entre si inclusive em
 * bloco pequeno, e todas têm contraste suficiente para texto branco.
 */

export interface CorCorretor {
  hex: string
  nome: string
}

export const CORES_CORRETORES: CorCorretor[] = [
  { hex: '#2F6B4F', nome: 'Verde mata' },
  { hex: '#1F6F8B', nome: 'Azul petróleo' },
  { hex: '#2D4B8E', nome: 'Azul marinho' },
  { hex: '#6A4C93', nome: 'Roxo' },
  { hex: '#A63D64', nome: 'Vinho' },
  { hex: '#C4442E', nome: 'Terracota' },
  { hex: '#D97706', nome: 'Âmbar' },
  { hex: '#8A6D1F', nome: 'Mostarda' },
  { hex: '#4F7A28', nome: 'Verde oliva' },
  { hex: '#0F766E', nome: 'Verde-água' },
  { hex: '#57534E', nome: 'Grafite' },
  { hex: '#B23A6B', nome: 'Magenta' },
]

export const COR_PADRAO = CORES_CORRETORES[0].hex

export function nomeDaCor(hex: string): string {
  return CORES_CORRETORES.find((cor) => iguais(cor.hex, hex))?.nome ?? 'Personalizada'
}

export function iguais(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Primeira cor ainda não usada. Sugerida ao cadastrar um corretor. */
export function primeiraCorLivre(usadas: string[]): string {
  const livre = CORES_CORRETORES.find((cor) => !usadas.some((usada) => iguais(usada, cor.hex)))
  return livre?.hex ?? COR_PADRAO
}

/**
 * Cor de texto legível sobre a cor do corretor.
 *
 * Luminância relativa aproximada (ITU-R BT.601). Todas as cores da
 * paleta pedem texto branco, mas um cadastro antigo pode ter uma cor
 * clara vinda de fora do painel.
 */
export function corDoTextoSobre(hex: string): string {
  const limpo = hex.replace('#', '')
  const completo =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo

  const r = parseInt(completo.slice(0, 2), 16)
  const g = parseInt(completo.slice(2, 4), 16)
  const b = parseInt(completo.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#ffffff'

  const luminancia = (r * 299 + g * 587 + b * 114) / 1000
  return luminancia > 150 ? '#1c1917' : '#ffffff'
}

/** Versão translúcida, para fundos de bloco e chips de filtro. */
export function comOpacidade(hex: string, alfa: number): string {
  const limpo = hex.replace('#', '')
  const completo =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo
  const r = parseInt(completo.slice(0, 2), 16)
  const g = parseInt(completo.slice(2, 4), 16)
  const b = parseInt(completo.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return hex
  return `rgba(${r}, ${g}, ${b}, ${alfa})`
}
