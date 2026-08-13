import { mascararCep } from '@/lib/formato'

/**
 * O endereço da imobiliária, nas duas formas em que a vitrine precisa
 * dele: a linha que a pessoa lê e a busca que o mapa consome.
 *
 * **Vive num arquivo só porque passou a ter dois consumidores.** O
 * rodapé mostra o endereço em toda página; a seção "Sobre" da home
 * mostra o mesmo endereço ao lado do mapa. Copiado nos dois, o primeiro
 * campo novo no cadastro apareceria em um e não no outro, e a divergência
 * só apareceria para quem lesse a home inteira até o rodapé.
 */

interface EnderecoDoNegocio {
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}

/**
 * Monta o endereço em uma linha, pulando o que estiver em branco.
 *
 * Concatenar direto produziria "Rua das Flores, , São Paulo - " quando
 * faltasse o número ou a cidade — que é exatamente o estado em que uma
 * imobiliária recém-implantada costuma estar.
 */
export function montarEndereco(configuracoes: EnderecoDoNegocio | null): string | null {
  if (!configuracoes) return null

  const linha = [
    configuracoes.endereco?.trim(),
    [configuracoes.cidade?.trim(), configuracoes.estado?.trim()].filter(Boolean).join(' - '),
    configuracoes.cep?.trim() ? `CEP ${mascararCep(configuracoes.cep)}` : null,
  ]
    .filter((parte) => Boolean(parte))
    .join(' · ')

  return linha || null
}

/**
 * O que vai na busca do mapa embutido, ou `null`.
 *
 * **Não usa `configuracoes.link_google_maps`, e não é escolha de
 * preferência.** O que a pessoa cola naquele campo é o link de
 * compartilhamento do Maps (`maps.app.goo.gl/…`), e o Google responde
 * `X-Frame-Options: SAMEORIGIN` nele, o que impede o iframe. Mapa
 * embutido exige `output=embed`, que não é o que o botão "Compartilhar"
 * produz. Montar a busca a partir do endereço já cadastrado resolve sem
 * chave de API e sem pedir nada de novo a quem implanta.
 *
 * `link_google_maps` continua servindo ao "Como chegar" da página do
 * imóvel, onde é link mesmo e funciona.
 *
 * **Exige rua e cidade.** Só com a cidade, o mapa aponta para o centro de
 * um município inteiro e responde "onde estamos" com um lugar onde a
 * imobiliária não está.
 */
export function consultaDoMapa(configuracoes: EnderecoDoNegocio | null): string | null {
  const rua = configuracoes?.endereco?.trim()
  const cidade = configuracoes?.cidade?.trim()
  if (!rua || !cidade) return null

  return [rua, cidade, configuracoes?.estado?.trim(), configuracoes?.cep?.trim()]
    .filter(Boolean)
    .join(', ')
}
