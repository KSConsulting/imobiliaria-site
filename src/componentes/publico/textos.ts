import { KeyRound, MessageCircle, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Textos fixos da vitrine.
 *
 * **Este é o único lugar onde o texto estático do site mora.** Hero,
 * "como funciona" e perguntas frequentes ficam aqui, e não espalhados
 * dentro dos componentes, porque personalizar o site para outra
 * imobiliária é a tarefa mais frequente da implantação — e ninguém
 * deveria precisar caçar frase dentro de JSX para fazer isso.
 *
 * Ver NICHO.md, seção "Onde mudar os textos do site".
 *
 * O que **não** está aqui, de propósito: nome, telefone, endereço e
 * redes sociais. Esses vêm das Configurações, porque mudam pelo painel,
 * sem deploy.
 */

/* ---------------------------------------------------------------- hero */

export const HERO = {
  titulo: 'O seu próximo endereço começa aqui',
  subtitulo:
    'Imóveis para comprar e alugar, com atendimento direto no WhatsApp e visita agendada na hora.',
}

/* -------------------------------------------------------- como funciona */

export interface Passo {
  icone: LucideIcon
  titulo: string
  texto: string
}

/**
 * Os três passos até a visita.
 *
 * A seção existe para preparar o clique no WhatsApp. Ela responde, antes
 * de a pessoa perguntar, quanto trabalho vai dar — e a resposta é
 * "quase nenhum". Quem entende que o caminho é curto clica; quem imagina
 * formulário e espera, não.
 */
export const PASSOS: Passo[] = [
  {
    icone: Search,
    titulo: 'Encontre o imóvel',
    texto:
      'Filtre por finalidade, bairro, valor e número de quartos até chegar no que faz sentido para você.',
  },
  {
    icone: MessageCircle,
    titulo: 'Chame no WhatsApp',
    texto:
      'O botão já envia o código do imóvel junto. Você não precisa explicar qual anúncio viu: a conversa começa no assunto.',
  },
  {
    icone: KeyRound,
    titulo: 'Agende a visita',
    texto:
      'A gente confere os horários disponíveis e marca a visita com um corretor, no dia que funcionar para você.',
  },
]

/* ------------------------------------------------------ perguntas comuns */

export interface Pergunta {
  pergunta: string
  resposta: string
}

/**
 * Perguntas frequentes.
 *
 * Escritas em termos genéricos de propósito, para servirem a qualquer
 * imobiliária sem prometer nada que a implantação específica não cumpra.
 * Nenhuma delas cita prazo, taxa ou percentual: é aí que o texto padrão
 * vira informação errada na mão do cliente.
 */
export const PERGUNTAS: Pergunta[] = [
  {
    pergunta: 'Como faço para visitar um imóvel?',
    resposta:
      'Clique no botão de WhatsApp da página do imóvel. A mensagem já vai com o código, e a gente confere os horários disponíveis com você na hora. A visita é acompanhada por um corretor.',
  },
  {
    pergunta: 'Preciso pagar alguma coisa para visitar?',
    resposta: 'Não. A visita é gratuita e sem compromisso, tanto para venda quanto para locação.',
  },
  {
    pergunta: 'Quais documentos são necessários para alugar?',
    resposta:
      'Em geral, documento de identidade, CPF e comprovante de renda, além da forma de garantia escolhida: fiador, seguro-fiança ou caução. Cada imóvel pode ter exigências próprias, e a gente confirma tudo antes de você separar qualquer papel.',
  },
  {
    pergunta: 'E para comprar, como funciona?',
    resposta:
      'Depois da visita e do acerto de valores, cuidamos da documentação, da análise do imóvel e do acompanhamento até a escritura. Se a compra for financiada, ajudamos com o processo junto ao banco.',
  },
  {
    pergunta: 'Os valores anunciados são negociáveis?',
    resposta:
      'Na maioria dos casos existe margem para conversa. Fale com a gente pelo WhatsApp informando o código do imóvel e verificamos a possibilidade com o proprietário.',
  },
  {
    pergunta: 'O imóvel que eu vi saiu do site. O que aconteceu?',
    resposta:
      'Provavelmente foi vendido, alugado ou retirado da carteira. Assim que isso acontece, o anúncio sai do ar, mas links antigos costumam continuar circulando por um tempo. Chame no WhatsApp que a gente procura alternativas parecidas.',
  },
]

/* --------------------------------------------------------- chamada final */

export const CHAMADA_FINAL = {
  titulo: 'Achou o imóvel? A visita pode ser esta semana',
  texto: 'Fale com a gente no WhatsApp e a gente combina o melhor horário.',
}

/* ------------------------------------------------------ sobre a empresa */

/**
 * Só o título e a frase de apresentação.
 *
 * Endereço, telefone e email **não** estão aqui: vêm das Configurações,
 * como o resto do que muda pelo painel. O texto abaixo é o único pedaço
 * dessa seção que exige deploy para trocar, e por isso ele é genérico o
 * bastante para servir a qualquer imobiliária sem prometer nada que a
 * implantação não cumpra.
 */
export const SOBRE = {
  titulo: 'Sobre a imobiliária',
  texto:
    'Atendemos venda e locação com corretor acompanhando cada visita, do primeiro contato à entrega das chaves. Passe no escritório ou fale com a gente por telefone e WhatsApp.',
}
