import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Building2,
  CalendarClock,
  Clock,
  Globe2,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Save,
  Undo2,
} from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Select } from '@/componentes/ui/select'
import { Campo, SecaoFormulario } from '@/componentes/SecaoFormulario'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { BlocoProntidao } from '@/componentes/configuracoes/BlocoProntidao'
import { CampoImagem } from '@/componentes/configuracoes/CampoImagem'
import { DestinoDado } from '@/componentes/configuracoes/DestinoDado'
import { usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'
import {
  enviarFotoHero,
  enviarLogo,
  FUSOS_BRASIL,
  normalizarUrlSite,
  removerImagem,
  salvarConfiguracoes,
  TAMANHO_MAXIMO_LOGO,
  TIPOS_HERO,
  TIPOS_LOGO,
  verificarProntidao,
  type Configuracao,
  type DadosConfiguracao,
  type ItemProntidao,
} from '@/lib/configuracoes'
import {
  EditorHorarioAtendimento,
  validarHorarioAtendimento,
} from '@/componentes/configuracoes/EditorHorarioAtendimento'
import { buscarEnderecoPorCep } from '@/lib/cep'
import { apenasDigitos, ESTADOS_BRASIL, mascararCep, mascararTelefone } from '@/lib/formato'
import { notificar } from '@/lib/notificacoes'
import { fusoDoNavegador } from '@/lib/datas'
import {
  conferirCoberturaCorretores,
  lerHorario,
  paraJson,
  type AvisoCobertura,
  type DiaFuncionamento,
} from '@/lib/horarioFuncionamento'

/**
 * Os campos de texto do formulário.
 *
 * `horario_funcionamento` fica de fora porque não é texto: são sete
 * linhas com alternador e duas horas cada. Ele vive em estado próprio,
 * e entra na comparação de "sujo" e no payload junto com o resto.
 */
type CamposTexto = Omit<DadosConfiguracao, 'horario_funcionamento'>

type Campos = {
  [C in keyof CamposTexto]: string
}

const VAZIO: Campos = {
  nome_negocio: '',
  logo_url: '',
  foto_hero_url: '',
  cep: '',
  endereco: '',
  cidade: '',
  estado: '',
  telefone: '',
  whatsapp: '',
  email: '',
  site: '',
  url_site: '',
  instagram: '',
  link_google_maps: '',
  fuso_horario: 'America/Sao_Paulo',
}

function paraCampos(configuracao: Configuracao | null): Campos {
  if (!configuracao) return VAZIO
  return {
    nome_negocio: configuracao.nome_negocio ?? '',
    logo_url: configuracao.logo_url ?? '',
    foto_hero_url: configuracao.foto_hero_url ?? '',
    cep: configuracao.cep ? mascararCep(configuracao.cep) : '',
    endereco: configuracao.endereco ?? '',
    cidade: configuracao.cidade ?? '',
    estado: configuracao.estado ?? '',
    telefone: configuracao.telefone ? mascararTelefone(configuracao.telefone) : '',
    whatsapp: configuracao.whatsapp ? mascararTelefone(configuracao.whatsapp) : '',
    email: configuracao.email ?? '',
    site: configuracao.site ?? '',
    url_site: configuracao.url_site ?? '',
    instagram: configuracao.instagram ?? '',
    link_google_maps: configuracao.link_google_maps ?? '',
    fuso_horario: configuracao.fuso_horario ?? 'America/Sao_Paulo',
  }
}

/**
 * Aba 1 — os dados da imobiliária.
 *
 * É a tela que torna o sistema implantável sem tocar em código. O que
 * está aqui alimenta **três destinos ao mesmo tempo** — painel, site
 * público e a API que o agente de IA consome — e é por isso que cada
 * seção diz para onde os dados dela vão.
 */
export function AbaDados({ aoMudarSujo }: { aoMudarSujo: (sujo: boolean) => void }) {
  const { configuracoes, carregando, recarregar } = usarConfiguracoes()

  const [campos, setCampos] = useState<Campos>(VAZIO)
  const [original, setOriginal] = useState<Campos>(VAZIO)
  const [horario, setHorario] = useState<DiaFuncionamento[]>(() => lerHorario(null))
  const [horarioOriginal, setHorarioOriginal] = useState<DiaFuncionamento[]>(() => lerHorario(null))
  const [errosHorario, setErrosHorario] = useState<Record<number, string>>({})
  const [avisosHorario, setAvisosHorario] = useState<AvisoCobertura[]>([])
  const [erros, setErros] = useState<Partial<Record<keyof Campos, string>>>({})
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [prontidao, setProntidao] = useState<ItemProntidao[]>([])

  /**
   * Arquivos que já subiram para o Storage mas ainda não foram salvos.
   *
   * Sem esta lista, trocar a logo e depois descartar as alterações
   * deixaria o arquivo novo pagando armazenamento para sempre, sem
   * nenhuma linha do banco apontando para ele.
   */
  const enviadasNaoSalvas = useRef<string[]>([])

  const carregado = useRef(false)

  useEffect(() => {
    // Só na primeira chegada das configurações. O contexto tem
    // subscription de Realtime ativa no painel: sem esta trava, uma
    // gravação vinda de outra aba sobrescreveria o que está sendo
    // digitado aqui, no meio da frase.
    if (carregando || carregado.current) return
    carregado.current = true

    const iniciais = paraCampos(configuracoes)
    setCampos(iniciais)
    setOriginal(iniciais)

    const horarioInicial = lerHorario(configuracoes?.horario_funcionamento)
    setHorario(horarioInicial)
    setHorarioOriginal(horarioInicial)
  }, [carregando, configuracoes])

  /**
   * A conferência contra a agenda dos corretores é uma consulta ao banco,
   * e os campos de hora disparam a cada tecla. O atraso existe para não
   * transformar a digitação de "09:30" em quatro consultas.
   */
  useEffect(() => {
    const relogio = setTimeout(() => {
      void conferirCoberturaCorretores(horario)
        .then(setAvisosHorario)
        // Aviso é orientação, não função. Falhar aqui não pode impedir
        // ninguém de salvar os dados da imobiliária.
        .catch(() => setAvisosHorario([]))
    }, 500)

    return () => clearTimeout(relogio)
  }, [horario])

  const recarregarProntidao = useCallback(async () => {
    try {
      setProntidao(await verificarProntidao(configuracoes))
    } catch {
      // Prontidão é orientação, não função. Falhar aqui não pode
      // impedir ninguém de editar os dados da imobiliária.
      setProntidao([])
    }
  }, [configuracoes])

  useEffect(() => {
    void recarregarProntidao()
  }, [recarregarProntidao])

  const sujo =
    JSON.stringify(campos) !== JSON.stringify(original) ||
    JSON.stringify(horario) !== JSON.stringify(horarioOriginal)

  useEffect(() => {
    aoMudarSujo(sujo)
  }, [sujo, aoMudarSujo])

  function definir<C extends keyof Campos>(campo: C, valor: string) {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }))
    setErros((atuais) => (atuais[campo] ? { ...atuais, [campo]: undefined } : atuais))
  }

  /* ---------------------------------------------------------------- CEP */
  async function aoSairDoCep() {
    const digitos = apenasDigitos(campos.cep)
    if (digitos.length !== 8) return

    setBuscandoCep(true)
    const encontrado = await buscarEnderecoPorCep(digitos)
    setBuscandoCep(false)

    if (!encontrado) {
      notificar.aviso('CEP não encontrado', 'Preencha o endereço manualmente.')
      return
    }

    setCampos((atuais) => ({
      ...atuais,
      endereco: encontrado.endereco || atuais.endereco,
      cidade: encontrado.cidade || atuais.cidade,
      estado: encontrado.estado || atuais.estado,
    }))

    // O bairro vem do ViaCEP e não tem coluna própria em `configuracoes`.
    // Vai na mensagem em vez de ser concatenado no endereço à força — o
    // formato do endereço da imobiliária é escolha de quem o escreve.
    notificar.sucesso(
      'Endereço preenchido',
      encontrado.bairro
        ? `Bairro ${encontrado.bairro}. Complete com o número.`
        : 'Complete com o número.',
    )
  }

  /* ------------------------------------------------------------ imagens */
  async function enviarImagem(tipo: 'logo' | 'hero', arquivo: File) {
    try {
      const url = tipo === 'logo' ? await enviarLogo(arquivo) : await enviarFotoHero(arquivo)
      enviadasNaoSalvas.current.push(url)
      definir(tipo === 'logo' ? 'logo_url' : 'foto_hero_url', url)
      notificar.informacao(
        tipo === 'logo' ? 'Logo carregada' : 'Foto carregada',
        'Ela só entra no site depois de salvar.',
      )
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível enviar a imagem.')
    }
  }

  /* ------------------------------------------------------------- salvar */
  function validar(): boolean {
    const novos: Partial<Record<keyof Campos, string>> = {}

    if (!campos.nome_negocio.trim()) {
      novos.nome_negocio = 'O nome da imobiliária é obrigatório.'
    }

    const whatsapp = apenasDigitos(campos.whatsapp)
    if (whatsapp && whatsapp.length < 10) {
      novos.whatsapp = 'Informe DDD e número. Com menos de 10 dígitos o botão do site não aparece.'
    }

    const telefone = apenasDigitos(campos.telefone)
    if (telefone && telefone.length < 10) {
      novos.telefone = 'Informe DDD e número.'
    }

    if (campos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email.trim())) {
      novos.email = 'E-mail inválido.'
    }

    const novosHorario = validarHorarioAtendimento(horario)

    setErros(novos)
    setErrosHorario(novosHorario)
    return Object.keys(novos).length === 0 && Object.keys(novosHorario).length === 0
  }

  async function salvar() {
    if (!validar()) {
      notificar.erro('Revise os campos destacados.')
      return
    }

    setSalvando(true)
    try {
      const dados: DadosConfiguracao = {
        nome_negocio: campos.nome_negocio,
        logo_url: campos.logo_url || null,
        foto_hero_url: campos.foto_hero_url || null,
        cep: apenasDigitos(campos.cep) || null,
        endereco: campos.endereco,
        cidade: campos.cidade,
        estado: campos.estado,
        telefone: apenasDigitos(campos.telefone) || null,
        whatsapp: apenasDigitos(campos.whatsapp) || null,
        email: campos.email,
        site: campos.site,
        url_site: campos.url_site,
        instagram: campos.instagram,
        link_google_maps: campos.link_google_maps,
        fuso_horario: campos.fuso_horario,
        horario_funcionamento: paraJson(horario),
      }

      const salvo = await salvarConfiguracoes(dados, configuracoes)

      // As imagens antigas só saem do Storage depois que o banco aceitou
      // a troca. Removê-las antes deixaria o site sem logo caso o
      // `update` falhasse.
      if (configuracoes?.logo_url && configuracoes.logo_url !== salvo.logo_url) {
        await removerImagem(configuracoes.logo_url)
      }
      if (configuracoes?.foto_hero_url && configuracoes.foto_hero_url !== salvo.foto_hero_url) {
        await removerImagem(configuracoes.foto_hero_url)
      }

      enviadasNaoSalvas.current = []
      const atualizados = paraCampos(salvo)
      setCampos(atualizados)
      setOriginal(atualizados)

      // Relido do que o banco devolveu, e não do estado local: dia
      // fechado não é gravado com horário, então o local e o salvo
      // divergiriam e a tela ficaria "suja" logo depois de salvar.
      const horarioSalvo = lerHorario(salvo.horario_funcionamento)
      setHorario(horarioSalvo)
      setHorarioOriginal(horarioSalvo)

      // A prontidão NÃO é recarregada aqui de propósito. `recarregar`
      // troca o objeto do contexto, `recarregarProntidao` depende dele e
      // o efeito acima refaz a verificação com o dado novo. Chamar
      // também daqui gravaria o resultado calculado sobre o estado
      // velho, para o efeito corrigir logo em seguida.
      await recarregar()

      notificar.sucesso(
        'Configurações salvas',
        'A sidebar e o site público já estão exibindo os novos dados.',
      )
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível salvar as configurações.')
    } finally {
      setSalvando(false)
    }
  }

  async function descartar() {
    // Arquivos que subiram nesta sessão de edição e não vão ser usados.
    const orfas = enviadasNaoSalvas.current
    enviadasNaoSalvas.current = []
    setCampos(original)
    setHorario(horarioOriginal)
    setErros({})
    setErrosHorario({})
    for (const url of orfas) await removerImagem(url)
  }

  function irParaCampo(chave: ItemProntidao['chave']) {
    const id = chave === 'nome' ? 'nome_negocio' : chave === 'whatsapp' ? 'whatsapp' : 'campo-logo'
    const elemento = document.getElementById(id)
    elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (elemento instanceof HTMLInputElement) setTimeout(() => elemento.focus(), 400)
  }

  if (carregando) return <EstadoCarregando mensagem="Carregando as configurações…" />

  const fusoDivergente = campos.fuso_horario !== fusoDoNavegador()

  // Passa pela mesma função que grava, e não por concatenação própria:
  // duas regras de normalização divergiriam no primeiro endereço colado
  // com barra no fim, e a prévia estaria mostrando um link diferente do
  // que a API monta.
  const baseNormalizada = normalizarUrlSite(campos.url_site)
  const previaDoImovel = baseNormalizada ? `${baseNormalizada}/imovel/IMV-0001` : null

  return (
    <div className="flex flex-col gap-5">
      <BlocoProntidao itens={prontidao} aoIrParaCampo={irParaCampo} />

      {/* ------------------------------------------------ Identidade --- */}
      <SecaoFormulario
        id="identidade"
        icone={Building2}
        titulo="Identidade"
        descricao="O nome e as imagens que aparecem em todo lugar."
        acao={<DestinoDado destinos={['painel', 'site', 'api']} />}
        comErro={Boolean(erros.nome_negocio)}
      >
        <div className="flex flex-col gap-6">
          <Campo
            id="nome_negocio"
            rotulo="Nome da imobiliária"
            obrigatorio
            erro={erros.nome_negocio}
            dica="Aparece na sidebar, no cabeçalho do site, no título da aba e na API."
          >
            <Input
              id="nome_negocio"
              value={campos.nome_negocio}
              onChange={(e) => definir('nome_negocio', e.target.value)}
              placeholder="Alvorada Imóveis"
            />
          </Campo>

          <div id="campo-logo" className="scroll-mt-24">
            <CampoImagem
              rotulo="Logo"
              valor={campos.logo_url || null}
              tiposAceitos={TIPOS_LOGO}
              tamanhoMaximo={TAMANHO_MAXIMO_LOGO}
              ajuste="contido"
              recomendacao="PNG, JPEG, WEBP ou SVG, até 5 MB. Fundo transparente e proporção horizontal (cerca de 3:1) funcionam melhor: a logo é exibida em faixa, ao lado do nome. Sobe sem recompressão: logo é traço e texto, onde o artefato de compressão aparece."
              semImagem="Sem logo, o cabeçalho, o rodapé e a tela de login exibem apenas o nome em texto."
              aoEscolher={(arquivo) => enviarImagem('logo', arquivo)}
              aoRemover={() => definir('logo_url', '')}
              desabilitado={salvando}
            />
          </div>

          <CampoImagem
            rotulo="Foto de fundo da home"
            valor={campos.foto_hero_url || null}
            tiposAceitos={TIPOS_HERO}
            ajuste="preenchido"
            recomendacao="PNG, JPEG ou WEBP. Horizontal e ampla, com o assunto ao centro, porque o texto da home fica por cima. É reduzida para 1920px e convertida em WEBP antes de subir, então pode enviar a foto do celular como está."
            semImagem="Sem foto, a primeira dobra do site usa o fundo sólido na cor de destaque."
            aoEscolher={(arquivo) => enviarImagem('hero', arquivo)}
            aoRemover={() => definir('foto_hero_url', '')}
            desabilitado={salvando}
          />
        </div>
      </SecaoFormulario>

      {/* --------------------------------------------------- Endereço --- */}
      <SecaoFormulario
        id="endereco"
        icone={MapPin}
        titulo="Endereço"
        descricao="O endereço da imobiliária, exibido no rodapé do site."
        acao={<DestinoDado destinos={['site', 'api']} />}
      >
        <div className="grid gap-5 sm:grid-cols-6">
          <Campo id="cep" rotulo="CEP" className="sm:col-span-2">
            <div className="relative">
              <Input
                id="cep"
                value={campos.cep}
                onChange={(e) => definir('cep', mascararCep(e.target.value))}
                onBlur={() => void aoSairDoCep()}
                placeholder="01310-100"
                inputMode="numeric"
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-texto-tenue" />
              )}
            </div>
          </Campo>

          <Campo
            id="endereco"
            rotulo="Endereço"
            className="sm:col-span-4"
            dica="Rua e número, do jeito que você quer que apareça no rodapé."
          >
            <Input
              id="endereco"
              value={campos.endereco}
              onChange={(e) => definir('endereco', e.target.value)}
              placeholder="Av. Paulista, 1000, Bela Vista"
            />
          </Campo>

          <Campo id="cidade" rotulo="Cidade" className="sm:col-span-4">
            <Input
              id="cidade"
              value={campos.cidade}
              onChange={(e) => definir('cidade', e.target.value)}
              placeholder="São Paulo"
            />
          </Campo>

          <Campo id="estado" rotulo="Estado" className="sm:col-span-2">
            <Select
              id="estado"
              value={campos.estado}
              onChange={(e) => definir('estado', e.target.value)}
            >
              <option value="">Selecione</option>
              {ESTADOS_BRASIL.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {sigla}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      </SecaoFormulario>

      {/* ---------------------------------------------------- Contato --- */}
      <SecaoFormulario
        id="contato"
        icone={Phone}
        titulo="Contato"
        descricao="Por onde o cliente fala com a imobiliária."
        acao={<DestinoDado destinos={['site', 'api']} />}
        comErro={Boolean(erros.whatsapp || erros.telefone || erros.email)}
      >
        <div className="flex flex-col gap-5">
          {/* O WhatsApp ganha destaque visual porque é o campo mais
              consequente da aba inteira: errado ou vazio, o site continua
              gerando cliques que não chegam a lugar nenhum — e o clique
              é registrado assim mesmo, então o Dashboard mostra
              atividade que não virou conversa. */}
          <div className="rounded-xl border border-destaque/30 bg-destaque-suave/40 p-4">
            <Campo
              id="whatsapp"
              rotulo="WhatsApp de atendimento"
              erro={erros.whatsapp}
              dica="É este número que recebe TODOS os cliques do site: o botão de cada imóvel e o do cabeçalho. A mensagem já chega escrita, com o código do imóvel dentro. Vazio, o botão simplesmente não aparece na vitrine."
            >
              <Input
                id="whatsapp"
                value={campos.whatsapp}
                onChange={(e) => definir('whatsapp', mascararTelefone(e.target.value))}
                placeholder="(11) 98765-4321"
                inputMode="tel"
              />
            </Campo>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo id="telefone" rotulo="Telefone fixo" erro={erros.telefone}>
              <Input
                id="telefone"
                value={campos.telefone}
                onChange={(e) => definir('telefone', mascararTelefone(e.target.value))}
                placeholder="(11) 3000-0000"
                inputMode="tel"
              />
            </Campo>

            <Campo id="email" rotulo="E-mail" erro={erros.email}>
              <Input
                id="email"
                type="email"
                value={campos.email}
                onChange={(e) => definir('email', e.target.value)}
                placeholder="contato@alvoradaimoveis.com.br"
              />
            </Campo>
          </div>
        </div>
      </SecaoFormulario>

      {/* -------------------------------------------- Presença digital -- */}
      <SecaoFormulario
        id="presenca"
        icone={Globe2}
        titulo="Presença digital"
        descricao="Onde a imobiliária também é encontrada. Cada campo tem um destino diferente, indicado na dica."
        acao={<DestinoDado destinos={['site', 'api']} />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {/* A dica diz onde o campo aparece, e não o que ele é, porque
              aqui os dois deixaram de coincidir: o ícone que levava a
              este endereço saiu do rodapé (a pessoa que o veria já está
              no site), e hoje ele só sai na frase do agente de IA. Sem
              essa linha, o campo pareceria alimentar a vitrine. */}
          <Campo
            id="site"
            rotulo="Site institucional"
            dica="Se a imobiliária tiver outro site além desta vitrine. Não é exibido aqui no site: entra na resposta do agente de IA quando o cliente pergunta pelos canais da imobiliária."
          >
            <Input
              id="site"
              value={campos.site}
              onChange={(e) => definir('site', e.target.value)}
              placeholder="alvoradaimoveis.com.br"
            />
          </Campo>

          <Campo
            id="instagram"
            rotulo="Instagram"
            dica="Pode ser o @ ou a URL completa. Vira o ícone do Instagram no rodapé do site."
          >
            <Input
              id="instagram"
              value={campos.instagram}
              onChange={(e) => definir('instagram', e.target.value)}
              placeholder="@alvoradaimoveis"
            />
          </Campo>

          <Campo
            id="link_google_maps"
            rotulo="Link do Google Maps"
            className="sm:col-span-2"
            dica='Aparece na página do imóvel como "Como chegar", e na resposta do agente de IA. Cole o link de compartilhamento do Maps. O mapa do rodapé e o da home não saem daqui: são montados a partir do endereço acima.'
          >
            <Input
              id="link_google_maps"
              value={campos.link_google_maps}
              onChange={(e) => definir('link_google_maps', e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
            />
          </Campo>
        </div>
      </SecaoFormulario>

      {/* ------------------------------------------- Endereço do site -- */}
      <SecaoFormulario
        id="url_site"
        icone={Link2}
        titulo="Endereço do site"
        descricao="Onde a vitrine está publicada."
        acao={<DestinoDado destinos={['api']} />}
      >
        <Campo
          id="url_site"
          rotulo="Endereço da vitrine"
          dica="A API devolve ao agente de IA o link da página de cada imóvel, montado a partir daqui. É assim que o cliente recebe no WhatsApp o endereço para ver as fotos. Vazio, o agente responde normalmente, só não manda link nenhum."
        >
          <Input
            id="url_site"
            value={campos.url_site}
            onChange={(e) => definir('url_site', e.target.value)}
            placeholder="alvoradaimoveis.com.br"
            inputMode="url"
          />
        </Campo>

        {/* A prévia existe porque o erro aqui é silencioso: um domínio
            digitado errado continua salvando, e o defeito só aparece
            semanas depois, na conversa de um cliente que clicou num link
            que não abre. */}
        {previaDoImovel && (
          <p className="mt-3 text-xs text-texto-tenue">
            O agente vai mandar assim:{' '}
            <code className="font-mono text-texto-suave">{previaDoImovel}</code>
          </p>
        )}
      </SecaoFormulario>

      {/* --------------------------------------- Horário de atendimento - */}
      {/* Fica coladinho no fuso horário porque os dois respondem à mesma
          pergunta: como o tempo funciona nesta imobiliária. Separados,
          são duas seções que ninguém liga uma à outra.

          São seções distintas, e não uma só, porque os destinos são
          diferentes: este vai para o site e para a API, o fuso vai para
          o painel e para a API. Fundidos, o `DestinoDado` teria que
          somar os dois e passaria a prometer errado dos dois lados. */}
      <SecaoFormulario
        id="horario-atendimento"
        icone={CalendarClock}
        titulo="Horário de atendimento"
        descricao="Quando a imobiliária atende o público. Não define os horários de visita, que vêm da agenda de cada corretor."
        acao={<DestinoDado destinos={['site', 'api']} />}
        comErro={Object.keys(errosHorario).length > 0}
      >
        <EditorHorarioAtendimento
          dias={horario}
          aoMudar={setHorario}
          erros={errosHorario}
          avisos={avisosHorario}
        />
      </SecaoFormulario>

      {/* ------------------------------------------------ Fuso horário -- */}
      <SecaoFormulario
        id="fuso"
        icone={Clock}
        titulo="Fuso horário"
        descricao="Base de todo horário do sistema."
        acao={<DestinoDado destinos={['painel', 'api']} />}
      >
        <Campo
          id="fuso_horario"
          rotulo="Fuso da imobiliária"
          dica="A agenda, os limites de janela de atendimento e o agrupamento por dia do Dashboard usam este fuso, e não o do computador de quem está olhando. Trocar aqui muda como os horários já gravados são exibidos."
        >
          <Select
            id="fuso_horario"
            value={campos.fuso_horario}
            onChange={(e) => definir('fuso_horario', e.target.value)}
          >
            {FUSOS_BRASIL.map((fuso) => (
              <option key={fuso.valor} value={fuso.valor}>
                {fuso.rotulo}
              </option>
            ))}
          </Select>
        </Campo>

        {fusoDivergente && (
          <p className="mt-3 rounded-lg border border-alerta/30 bg-alerta/6 px-3.5 py-2.5 text-xs leading-relaxed text-texto-suave">
            Este computador está em <strong>{fusoDoNavegador()}</strong>, diferente do fuso
            configurado. Não é erro. Só significa que os horários exibidos seguem o fuso da
            imobiliária, e não o daqui.
          </p>
        )}
      </SecaoFormulario>

      {/* ------------------------------------------------ Barra de ação -
          `sticky`, e não `fixed`: a largura da sidebar muda com o modo
          compacto e vive no estado do LayoutPainel. Uma barra fixa
          precisaria conhecer esse número e passaria por baixo dela no
          dia em que ele mudasse. */}
      {sujo && (
        <div className="sticky bottom-4 z-30">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-superficie/95 px-4 py-3 shadow-sobreposto backdrop-blur">
            <p className="text-sm text-texto-suave">Você tem alterações não salvas.</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variante="fantasma"
                onClick={() => void descartar()}
                disabled={salvando}
              >
                <Undo2 className="size-4" />
                Descartar
              </Button>
              <Button type="button" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
