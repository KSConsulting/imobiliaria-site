import { useEffect } from 'react'

/**
 * Metadados de compartilhamento (Open Graph) da página atual.
 *
 * Quando alguém cola o link do imóvel no WhatsApp, a prévia com foto,
 * título e valor decide se a mensagem vira conversa ou passa batido.
 *
 * **Limite importante, e ele é do tipo de aplicação, não deste código.**
 * O ImobFlow é uma SPA: o HTML que sai do servidor é uma casca vazia, e
 * as tags abaixo são escritas pelo navegador depois que o React monta. O
 * robô de prévia do WhatsApp, do Facebook e do Telegram **não executa
 * JavaScript** — ele lê o HTML cru e vai embora. Então estas tags servem
 * ao navegador, a quem inspeciona a página e a robôs que renderizam,
 * mas **não bastam para a prévia do WhatsApp em produção**.
 *
 * O que fecha essa lacuna é entregar HTML já com as tags para o robô, o
 * que é decisão de publicação e não de aplicação: pré-renderização no
 * build ou uma função de borda que responda ao user-agent do robô. Fica
 * para a Etapa 11 (deploy), e está registrado no README para não virar
 * surpresa no dia em que o primeiro link for compartilhado.
 */

export interface Metadados {
  titulo: string
  descricao: string
  imagem?: string | null
  /** Caminho da página. Vira a URL absoluta da tag `og:url`. */
  caminho?: string
}

/** Tags criadas por este hook, para poder removê-las na saída. */
const MARCA = 'data-imobflow-og'

function definirMeta(atributo: 'property' | 'name', chave: string, valor: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${chave}"]`)

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(atributo, chave)
    tag.setAttribute(MARCA, '')
    document.head.appendChild(tag)
  }

  tag.setAttribute('content', valor)
}

export function usarMetadados({ titulo, descricao, imagem, caminho }: Metadados) {
  useEffect(() => {
    const url = `${window.location.origin}${caminho ?? window.location.pathname}`

    definirMeta('name', 'description', descricao)

    definirMeta('property', 'og:type', 'website')
    definirMeta('property', 'og:title', titulo)
    definirMeta('property', 'og:description', descricao)
    definirMeta('property', 'og:url', url)

    definirMeta('name', 'twitter:card', imagem ? 'summary_large_image' : 'summary')
    definirMeta('name', 'twitter:title', titulo)
    definirMeta('name', 'twitter:description', descricao)

    if (imagem) {
      definirMeta('property', 'og:image', imagem)
      definirMeta('name', 'twitter:image', imagem)
    } else {
      // Sem foto, a tag precisa sair. Deixada para trás, a página do
      // imóvel sem imagem herdaria a foto do imóvel visitado antes.
      for (const chave of ['og:image', 'twitter:image']) {
        document.head
          .querySelector(`meta[property="${chave}"], meta[name="${chave}"]`)
          ?.remove()
      }
    }
  }, [titulo, descricao, imagem, caminho])
}
