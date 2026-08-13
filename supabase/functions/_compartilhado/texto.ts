/* ====================================================================
   Normalização de texto para comparação

   Quem digita nesta API é um modelo de linguagem, não uma pessoa
   olhando a tela. Ele escreve "sitio" e "Sítio", "apto" e "apartamento",
   "sao paulo" e "São Paulo", e nenhuma dessas variações deveria mudar o
   resultado da busca.

   A tolerância existe **só aqui**, do lado da API. O painel e a vitrine
   continuam estritos de propósito: lá quem digita é uma pessoa vendo a
   lista na tela, e adivinhar o que ela quis dizer atrapalha mais do que
   ajuda.

   Os dados continuam gravados com acento. A normalização acontece na
   comparação, nunca na escrita.
   ==================================================================== */

/**
 * Minúsculas, sem acento, sem espaço sobrando.
 *
 * O `NFD` separa a letra do acento, e o `replace` seguinte remove os
 * sinais combinantes que sobram, o intervalo U+0300 a U+036F.
 *
 * ⚠️ Os dois caracteres dentro dos colchetes são **combinantes e
 * invisíveis** no editor: a linha parece ter colchetes vazios com um
 * hífen no meio. Não os apague achando que é sujeira, e ao editar esta
 * linha confira com `node -e` que os pontos de código continuam sendo
 * 0x300 e 0x36f. Sem eles a normalização deixa de tirar acento, e a
 * busca da API volta a não achar "Sítio" quando o agente escreve
 * "sitio".
 */
export function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Quebra "moema, itaim, tatuape" numa lista de termos normalizados.
 *
 * Remove `%`, `_` e `\` antes de tudo. Eles não são mais curinga aqui,
 * porque a comparação passou a ser feita em memória, mas um termo que
 * seja só isso continua sendo lixo, e o vazio precisa ser reconhecido
 * como vazio em vez de virar "traga a carteira inteira".
 *
 * Devolve lista sem repetição e sem itens vazios. Lista vazia significa
 * que não sobrou nada de útil.
 */
export function listaDeTermos(bruto: string): string[] {
  const vistos = new Set<string>()

  for (const parte of bruto.split(',')) {
    const termo = normalizar(parte.replace(/[\\%_]/g, '')).slice(0, 120)
    if (termo) vistos.add(termo)
  }

  return [...vistos]
}

/**
 * Casa um termo contra um valor gravado, os dois já normalizados.
 *
 * Compara nos dois sentidos para preservar a busca por pedaço que o
 * `ilike '%termo%'` dava: "jardim" continua achando "Jardim Paulista", e
 * "apartamento padrao" continua achando o tipo "Apartamento".
 */
export function casa(termo: string, valor: string): boolean {
  return valor.includes(termo) || termo.includes(valor)
}
