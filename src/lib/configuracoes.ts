import { supabase, type Configuracao } from '@/lib/supabase'
import { Acoes, registrarLog } from '@/lib/logs'
import { comprimirImagem } from '@/lib/imagens'

export type { Configuracao }

/** Bucket da identidade visual da imobiliária. Ver BANCO.md, "Storage". */
export const BUCKET_LOGOS = 'logos'

/** Campos editáveis pela tela. `id`, `created_at` e `updated_at` ficam de fora. */
export type DadosConfiguracao = Pick<
  Configuracao,
  | 'nome_negocio'
  | 'logo_url'
  | 'foto_hero_url'
  | 'cep'
  | 'endereco'
  | 'cidade'
  | 'estado'
  | 'telefone'
  | 'whatsapp'
  | 'email'
  | 'site'
  | 'url_site'
  | 'instagram'
  | 'link_google_maps'
  | 'fuso_horario'
  | 'horario_funcionamento'
>

/* ------------------------------------------------------------------ */
/* Destinos — onde cada dado aparece                                   */
/* ------------------------------------------------------------------ */

/**
 * Um dado de `configuracoes` pode ir para três lugares ao mesmo tempo, e
 * o usuário não tem como adivinhar quais.
 *
 * Isso não é enfeite: sem a indicação, alguém preenche o WhatsApp
 * achando que é anotação interna e publica o número pessoal na vitrine.
 * O caminho inverso é igualmente ruim — deixar o campo vazio por
 * cautela e o site perder o único botão que gera contato.
 */
export type Destino = 'painel' | 'site' | 'api'

export const ROTULOS_DESTINO: Record<Destino, string> = {
  painel: 'Painel',
  site: 'Site público',
  api: 'API',
}

/* ------------------------------------------------------------------ */
/* Fuso horário                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fusos do Brasil, com o nome pelo qual as pessoas os conhecem.
 *
 * Está aqui, e não numa constante do código, porque a agenda inteira
 * depende dele: os triggers de conflito e de janela de atendimento
 * convertem pelo fuso desta tabela (ver BANCO.md). Uma imobiliária de
 * Manaus com o campo em São Paulo ofereceria horários que o banco
 * recusa — e a Agenda passaria a exibir o aviso de divergência todo dia.
 */
export const FUSOS_BRASIL: { valor: string; rotulo: string }[] = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília (SP, RJ, MG, PR, SC, RS, GO, DF, ES)' },
  { valor: 'America/Bahia', rotulo: 'Bahia e Sergipe' },
  { valor: 'America/Fortaleza', rotulo: 'Nordeste (CE, RN, PB, PE, AL, PI, MA)' },
  { valor: 'America/Belem', rotulo: 'Pará e Amapá' },
  { valor: 'America/Araguaina', rotulo: 'Tocantins' },
  { valor: 'America/Campo_Grande', rotulo: 'Mato Grosso do Sul' },
  { valor: 'America/Cuiaba', rotulo: 'Mato Grosso' },
  { valor: 'America/Manaus', rotulo: 'Amazonas' },
  { valor: 'America/Porto_Velho', rotulo: 'Rondônia' },
  { valor: 'America/Boa_Vista', rotulo: 'Roraima' },
  { valor: 'America/Rio_Branco', rotulo: 'Acre' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha' },
]

/* ------------------------------------------------------------------ */
/* Leitura e escrita                                                   */
/* ------------------------------------------------------------------ */

export async function buscarConfiguracoes(): Promise<Configuracao | null> {
  const { data, error } = await supabase.from('configuracoes').select('*').maybeSingle()
  if (error) throw error
  return data
}

/**
 * Grava os dados da imobiliária.
 *
 * O registro é único por índice sobre expressão constante (ver
 * migration …002). Se ele ainda não existir — o caso de um banco
 * replicado sem o seed —, esta função cria em vez de falhar: a tela de
 * Configurações é justamente onde alguém iria resolver isso, e não faz
 * sentido exigir um `insert` manual no SQL para poder usá-la.
 */
export async function salvarConfiguracoes(
  dados: DadosConfiguracao,
  anterior: Configuracao | null,
): Promise<Configuracao> {
  const limpos = normalizar(dados)

  if (!anterior) {
    const { data, error } = await supabase.from('configuracoes').insert(limpos).select().single()
    if (error) throw error

    await registrarLog({
      acao: Acoes.configuracoesAtualizadas,
      tabela: 'configuracoes',
      idRegistro: data.id,
      dadosNovos: data,
    })
    return data
  }

  const { data, error } = await supabase
    .from('configuracoes')
    .update(limpos)
    .eq('id', anterior.id)
    .select()
    .single()

  if (error) throw error

  await registrarLog({
    acao: Acoes.configuracoesAtualizadas,
    tabela: 'configuracoes',
    idRegistro: anterior.id,
    dadosAnteriores: anterior,
    dadosNovos: data,
  })

  return data
}

/**
 * Campo vazio vira `null`, não string vazia.
 *
 * A vitrine decide o que renderizar testando o valor (`configuracoes.site &&
 * …`, ver RodapeSite). String vazia é falsa em JavaScript, então hoje o
 * resultado seria o mesmo — mas a API da Etapa 9 devolve o JSON como
 * está, e `"instagram": ""` obrigaria cada consumidor a inventar a
 * própria regra de "vazio". `null` já significa ausente em todo lugar.
 */
function normalizar(dados: DadosConfiguracao): DadosConfiguracao {
  // `nome_negocio` e `fuso_horario` são NOT NULL no banco e ficam de
  // fora do tratamento — só são aparados. Os dois têm valor sempre: o
  // nome é obrigatório na tela e o fuso tem padrão.
  return {
    nome_negocio: dados.nome_negocio.trim(),
    fuso_horario: dados.fuso_horario.trim() || 'America/Sao_Paulo',
    logo_url: vazioParaNulo(dados.logo_url),
    foto_hero_url: vazioParaNulo(dados.foto_hero_url),
    cep: vazioParaNulo(dados.cep),
    endereco: vazioParaNulo(dados.endereco),
    cidade: vazioParaNulo(dados.cidade),
    estado: vazioParaNulo(dados.estado),
    telefone: vazioParaNulo(dados.telefone),
    whatsapp: vazioParaNulo(dados.whatsapp),
    email: vazioParaNulo(dados.email),
    site: vazioParaNulo(dados.site),
    url_site: normalizarUrlSite(dados.url_site),
    instagram: vazioParaNulo(dados.instagram),
    link_google_maps: vazioParaNulo(dados.link_google_maps),
    // Já chega normalizado de `paraJson`, que devolve `null` quando
    // nenhum dia está aberto. Passa direto porque não é texto: o
    // `trim()` dos demais não se aplica, e o "vazio" dele tem regra
    // própria. Ver src/lib/horarioFuncionamento.ts.
    horario_funcionamento: dados.horario_funcionamento,
  }
}

function vazioParaNulo(valor: string | null): string | null {
  const aparado = valor?.trim() ?? ''
  return aparado === '' ? null : aparado
}

/**
 * Guarda o endereço da vitrine já pronto para concatenar.
 *
 * A API monta `<url_site>/imovel/IMV-0001`, então os dois defeitos que a
 * digitação produz quebram o link de formas diferentes: sem protocolo, o
 * WhatsApp entrega um endereço que nem sempre vira clique; com barra no
 * fim, a URL sai com `//imovel` no meio.
 *
 * Corrigir na gravação, e não na leitura, porque quem confere é a pessoa
 * que acabou de salvar: o campo volta escrito como a API vai usar, e uma
 * digitação errada aparece ali, não semanas depois na conversa de um
 * cliente.
 */
export function normalizarUrlSite(valor: string | null): string | null {
  const aparado = valor?.trim() ?? ''
  if (aparado === '') return null

  const comProtocolo = /^https?:\/\//i.test(aparado) ? aparado : `https://${aparado}`
  return comProtocolo.replace(/\/+$/, '')
}

/* ------------------------------------------------------------------ */
/* Imagens                                                             */
/* ------------------------------------------------------------------ */

export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
export const TIPOS_HERO = ['image/png', 'image/jpeg', 'image/webp']
/** Limite do bucket `logos`, definido na migration …009. */
export const TAMANHO_MAXIMO_LOGO = 5 * 1024 * 1024

/**
 * Sobe a logo **sem recomprimir**.
 *
 * Logo é texto e traço reto, exatamente onde o artefato de compressão
 * com perda aparece. E SVG precisa continuar SVG: rasterizar um vetor
 * para WEBP resolveria o tamanho de arquivo que ele já não tinha, em
 * troca de perder a nitidez em qualquer tela grande.
 */
export async function enviarLogo(arquivo: File): Promise<string> {
  return enviar('logo', arquivo)
}

/**
 * Sobe a foto de fundo do hero, **com** compressão.
 *
 * Aqui a decisão se inverte: é uma fotografia exibida em largura total,
 * e vem do celular com 4 a 12 MB — acima do limite de 5 MB do bucket. A
 * compressão para 1920px em WEBP não é otimização, é o que faz o upload
 * caber.
 */
export async function enviarFotoHero(arquivo: File): Promise<string> {
  const { arquivo: comprimido } = await comprimirImagem(arquivo)
  return enviar('hero', comprimido)
}

async function enviar(pasta: 'logo' | 'hero', arquivo: File): Promise<string> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() || 'png'
  const caminho = `${pasta}/${crypto.randomUUID()}.${extensao}`

  const { error } = await supabase.storage
    .from(BUCKET_LOGOS)
    .upload(caminho, arquivo, { cacheControl: '31536000', upsert: false })

  if (error) throw error
  return supabase.storage.from(BUCKET_LOGOS).getPublicUrl(caminho).data.publicUrl
}

/**
 * Apaga o arquivo anterior do Storage.
 *
 * Nunca lança. Trocar a logo é uma ação de tela; se a limpeza falhar, o
 * pior que acontece é um arquivo órfão pagando armazenamento — bem
 * menos grave do que a troca falhar depois de o banco já ter gravado a
 * URL nova.
 */
export async function removerImagem(url: string | null | undefined): Promise<void> {
  if (!url) return
  const marcador = `/storage/v1/object/public/${BUCKET_LOGOS}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return

  const caminho = decodeURIComponent(url.slice(indice + marcador.length))
  const { error } = await supabase.storage.from(BUCKET_LOGOS).remove([caminho])
  if (error) console.warn('[storage] falha ao remover a imagem antiga:', error.message)
}

/* ------------------------------------------------------------------ */
/* Prontidão para publicar                                             */
/* ------------------------------------------------------------------ */

export interface ItemProntidao {
  chave: 'nome' | 'whatsapp' | 'logo' | 'imoveis'
  rotulo: string
  /** O que quebra sem isso. Não é a repetição do rótulo. */
  consequencia: string
  pronto: boolean
  /** Para onde ir para resolver. Rota interna. */
  destino: string
  rotuloDestino: string
}

/**
 * O que falta para o site poder ser divulgado.
 *
 * Os quatro itens não são um checklist genérico de cadastro: cada um
 * deles, faltando, produz um site que abre normalmente e não funciona —
 * que é o pior tipo de falha, porque ninguém percebe. Sem WhatsApp o
 * visitante clica no botão principal e não acontece nada; sem imóvel
 * ativo a vitrine abre vazia; sem logo o cabeçalho exibe só texto.
 */
export async function verificarProntidao(configuracoes: Configuracao | null): Promise<ItemProntidao[]> {
  const { count } = await supabase
    .from('imoveis')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ativo')

  const ativos = count ?? 0

  return [
    {
      chave: 'nome',
      rotulo: 'Nome da imobiliária',
      consequencia: 'Sem ele, o cabeçalho do site e o título da aba saem com o nome do sistema.',
      pronto: Boolean(configuracoes?.nome_negocio?.trim()),
      destino: '/painel/configuracoes',
      rotuloDestino: 'Preencher agora',
    },
    {
      chave: 'whatsapp',
      rotulo: 'WhatsApp de atendimento',
      consequencia:
        'É o número que recebe todos os cliques do site. Vazio, o botão principal da vitrine simplesmente não aparece.',
      pronto: Boolean(configuracoes?.whatsapp?.trim()),
      destino: '/painel/configuracoes',
      rotuloDestino: 'Preencher agora',
    },
    {
      chave: 'logo',
      rotulo: 'Logo cadastrada',
      consequencia: 'Sem ela, cabeçalho, rodapé e tela de login exibem apenas o nome em texto.',
      pronto: Boolean(configuracoes?.logo_url?.trim()),
      destino: '/painel/configuracoes',
      rotuloDestino: 'Enviar logo',
    },
    {
      chave: 'imoveis',
      rotulo: 'Ao menos um imóvel ativo',
      consequencia: 'A vitrine abre vazia, e quem chega pelo link conclui que a imobiliária não tem estoque.',
      pronto: ativos > 0,
      destino: '/painel/imoveis/novo',
      rotuloDestino: 'Cadastrar imóvel',
    },
  ]
}
