import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  FileText,
  Images,
  Loader2,
  MapPin,
  Ruler,
  Save,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Select } from '@/componentes/ui/select'
import { Textarea } from '@/componentes/ui/textarea'
import { Alternador } from '@/componentes/ui/alternador'
import { Contador } from '@/componentes/ui/contador'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { EstadoCarregando } from '@/componentes/EstadoCarregando'
import { Campo, SecaoFormulario } from '@/componentes/SecaoFormulario'
import { GerenciadorFotos, type FotoEmEdicao } from '@/componentes/imoveis/GerenciadorFotos'
import { SeletorCaracteristicas } from '@/componentes/imoveis/SeletorCaracteristicas'
import {
  atualizarImovel,
  buscarImovel,
  criarImovel,
  listarTiposImovel,
  type DadosImovel,
  type FotoImovel,
  type Imovel,
  type TipoImovel,
} from '@/lib/imoveis'
import { sincronizarFotos } from '@/lib/fotosImovel'
import { buscarEnderecoPorCep } from '@/lib/cep'
import {
  ESTADOS_BRASIL,
  mascararCep,
  mascararMoeda,
  moedaParaNumero,
  numeroParaMoeda,
  textoParaNumero,
} from '@/lib/formato'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

interface EstadoFormulario {
  titulo: string
  id_tipo_imovel: string
  finalidade: string
  descricao: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  valor_venda: string
  valor_aluguel: string
  valor_condominio: string
  valor_iptu: string
  area_total: string
  area_util: string
  quartos: number
  suites: number
  banheiros: number
  vagas: number
  mobiliado: boolean
  aceita_pet: boolean
  caracteristicas: string[]
  proprietario_nome: string
  proprietario_contato: string
}

const INICIAL: EstadoFormulario = {
  titulo: '',
  id_tipo_imovel: '',
  finalidade: '',
  descricao: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  valor_venda: '',
  valor_aluguel: '',
  valor_condominio: '',
  valor_iptu: '',
  area_total: '',
  area_util: '',
  quartos: 0,
  suites: 0,
  banheiros: 0,
  vagas: 0,
  mobiliado: false,
  aceita_pet: false,
  caracteristicas: [],
  proprietario_nome: '',
  proprietario_contato: '',
}

type Erros = Partial<Record<keyof EstadoFormulario, string>>

export function ImovelFormulario() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const editando = Boolean(id)

  const [formulario, setFormulario] = useState<EstadoFormulario>(INICIAL)
  const [fotos, setFotos] = useState<FotoEmEdicao[]>([])
  const [fotosOriginais, setFotosOriginais] = useState<FotoImovel[]>([])
  const [imovelOriginal, setImovelOriginal] = useState<Imovel | null>(null)
  const [tipos, setTipos] = useState<TipoImovel[]>([])
  const [erros, setErros] = useState<Erros>({})
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [proprietarioAberto, setProprietarioAberto] = useState(false)

  const referencia = useRef('')
  const salvo = useRef(false)

  const sujo = useMemo(
    () => !salvando && !salvo.current && referencia.current !== assinar(formulario, fotos),
    [formulario, fotos, salvando],
  )

  // ---------------------------------------------------------------- carga
  useEffect(() => {
    void (async () => {
      try {
        const listaTipos = await listarTiposImovel()
        setTipos(listaTipos)

        if (!id) {
          referencia.current = assinar(INICIAL, [])
          return
        }

        const imovel = await buscarImovel(id)
        if (!imovel) {
          notificar.erro('Imóvel não encontrado', 'Ele pode ter sido excluído.')
          navegar('/painel/imoveis', { replace: true })
          return
        }

        const estado = paraFormulario(imovel)
        const galeria: FotoEmEdicao[] = [...(imovel.imoveis_fotos ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .map((foto) => ({ chave: foto.id, id: foto.id, previa: foto.url, capa: foto.capa }))

        setImovelOriginal(imovel)
        setFormulario(estado)
        setFotos(galeria)
        setFotosOriginais(imovel.imoveis_fotos ?? [])
        setProprietarioAberto(
          Boolean(imovel.proprietario_nome || imovel.proprietario_contato),
        )
        referencia.current = assinar(estado, galeria)
      } catch (erro) {
        notificar.erroDoBanco(erro, 'Não foi possível carregar o imóvel.')
        navegar('/painel/imoveis', { replace: true })
      } finally {
        setCarregando(false)
      }
    })()
  }, [id, navegar])

  // --------------------------------------------- aviso de saída sem salvar
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!sujo) return
    const aviso = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  // ---------------------------------------------------------------- campos
  function definir<C extends keyof EstadoFormulario>(campo: C, valor: EstadoFormulario[C]) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => (atuais[campo] ? { ...atuais, [campo]: undefined } : atuais))
  }

  async function aoSairDoCep() {
    const digitos = formulario.cep.replace(/\D/g, '')
    if (digitos.length !== 8) return

    setBuscandoCep(true)
    const encontrado = await buscarEnderecoPorCep(digitos)
    setBuscandoCep(false)

    if (!encontrado) {
      notificar.aviso('CEP não encontrado', 'Preencha o endereço manualmente.')
      return
    }

    // Não sobrescreve o que já foi digitado: quem corrigiu o bairro à
    // mão não quer ver a correção sumir ao voltar no campo do CEP.
    setFormulario((atual) => ({
      ...atual,
      endereco: atual.endereco || encontrado.endereco,
      bairro: atual.bairro || encontrado.bairro,
      cidade: atual.cidade || encontrado.cidade,
      estado: atual.estado || encontrado.estado,
    }))
    setErros({})
  }

  // ------------------------------------------------------------- validação
  function validar(): Erros {
    const novos: Erros = {}
    const { finalidade } = formulario

    if (!formulario.titulo.trim()) novos.titulo = 'Informe o título do imóvel.'
    if (!formulario.id_tipo_imovel) novos.id_tipo_imovel = 'Escolha o tipo de imóvel.'
    if (!finalidade) novos.finalidade = 'Escolha a finalidade.'
    if (!formulario.bairro.trim()) novos.bairro = 'Informe o bairro.'
    if (!formulario.cidade.trim()) novos.cidade = 'Informe a cidade.'
    if (!formulario.estado) novos.estado = 'Escolha o estado.'

    // Mesma regra da constraint `imoveis_valor_por_finalidade`. Validar
    // aqui é cortesia; o banco impõe de qualquer forma.
    if ((finalidade === 'venda' || finalidade === 'ambos') && !moedaParaNumero(formulario.valor_venda)) {
      novos.valor_venda = 'Imóvel à venda precisa do valor de venda.'
    }
    if (
      (finalidade === 'locacao' || finalidade === 'ambos') &&
      !moedaParaNumero(formulario.valor_aluguel)
    ) {
      novos.valor_aluguel = 'Imóvel para locação precisa do valor do aluguel.'
    }

    return novos
  }

  const secoesComErro = {
    identificacao: Boolean(erros.titulo || erros.id_tipo_imovel || erros.finalidade),
    localizacao: Boolean(erros.bairro || erros.cidade || erros.estado),
    valores: Boolean(erros.valor_venda || erros.valor_aluguel),
  }

  // ---------------------------------------------------------------- salvar
  async function salvar() {
    const novos = validar()
    setErros(novos)

    if (Object.keys(novos).length > 0) {
      const primeira = secaoDoPrimeiroErro(novos)
      document.getElementById(primeira)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      notificar.erro(
        'Revise o formulário',
        'Alguns campos obrigatórios ainda precisam ser preenchidos.',
      )
      return
    }

    setSalvando(true)
    try {
      const dados = paraBanco(formulario)

      const imovel =
        editando && imovelOriginal
          ? await atualizarImovel(imovelOriginal.id, dados, imovelOriginal)
          : await criarImovel(dados)

      await sincronizarFotos(imovel.id, fotos, fotosOriginais)

      salvo.current = true
      notificar.sucesso(
        editando ? 'Imóvel atualizado' : `Imóvel cadastrado · ${imovel.codigo}`,
        editando
          ? `${imovel.codigo} foi salvo e já reflete no site.`
          : `O código ${imovel.codigo} foi gerado automaticamente. Use-o para se referir a este imóvel.`,
      )
      navegar('/painel/imoveis')
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível salvar o imóvel.')
      setSalvando(false)
    }
  }

  if (carregando) return <EstadoCarregando mensagem="Carregando o imóvel…" />

  const mostraVenda = formulario.finalidade === 'venda' || formulario.finalidade === 'ambos'
  const mostraAluguel = formulario.finalidade === 'locacao' || formulario.finalidade === 'ambos'

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button
            variante="fantasma"
            tamanho="pequeno"
            onClick={() => navegar('/painel/imoveis')}
            className="-ml-2 w-fit"
          >
            <ArrowLeft className="size-4" />
            Voltar para imóveis
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="titulo-pagina">
              {editando ? 'Editar imóvel' : 'Novo imóvel'}
            </h2>
            {imovelOriginal && (
              <>
                {/* O código é gerado pelo banco e nunca editável. */}
                <Badge variante="suave" className="font-mono text-sm">
                  {imovelOriginal.codigo}
                </Badge>
                <Badge variante={imovelOriginal.status === 'ativo' ? 'neutro' : 'inativo'}>
                  {imovelOriginal.status === 'ativo' ? 'Ativo na vitrine' : 'Inativo'}
                </Badge>
              </>
            )}
          </div>

          <p className="texto-apoio max-w-2xl">
            {editando
              ? 'As alterações refletem no site público assim que salvas.'
              : 'O código IMV-XXXX é gerado automaticamente ao salvar.'}
          </p>
        </div>

        <Button onClick={() => void salvar()} disabled={salvando} tamanho="grande">
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {salvando ? 'Salvando…' : 'Salvar imóvel'}
        </Button>
      </div>

      {/* ---------------- 1. Identificação ---------------- */}
      <SecaoFormulario
        id="secao-identificacao"
        icone={FileText}
        titulo="Identificação"
        descricao="O que o imóvel é e para que ele está anunciado."
        comErro={secoesComErro.identificacao}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="titulo"
            rotulo="Título"
            obrigatorio
            erro={erros.titulo}
            dica="Aparece como chamada do anúncio na vitrine."
            className="sm:col-span-2"
          >
            <Input
              id="titulo"
              value={formulario.titulo}
              onChange={(e) => definir('titulo', e.target.value)}
              placeholder="Casa com 3 quartos e quintal no Jardim Europa"
              aria-invalid={Boolean(erros.titulo)}
              maxLength={140}
            />
          </Campo>

          <Campo id="tipo" rotulo="Tipo de imóvel" obrigatorio erro={erros.id_tipo_imovel}>
            <Select
              id="tipo"
              value={formulario.id_tipo_imovel}
              onChange={(e) => definir('id_tipo_imovel', e.target.value)}
              aria-invalid={Boolean(erros.id_tipo_imovel)}
            >
              <option value="">Selecione…</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            id="finalidade"
            rotulo="Finalidade"
            obrigatorio
            erro={erros.finalidade}
            dica="Define quais valores são obrigatórios."
          >
            <Select
              id="finalidade"
              value={formulario.finalidade}
              onChange={(e) => definir('finalidade', e.target.value)}
              aria-invalid={Boolean(erros.finalidade)}
            >
              <option value="">Selecione…</option>
              <option value="venda">Venda</option>
              <option value="locacao">Locação</option>
              <option value="ambos">Venda e Locação</option>
            </Select>
          </Campo>

          <Campo
            id="descricao"
            rotulo="Descrição"
            className="sm:col-span-2"
            dica="Texto livre exibido na página do imóvel."
          >
            <Textarea
              id="descricao"
              value={formulario.descricao}
              onChange={(e) => definir('descricao', e.target.value)}
              placeholder="Descreva o imóvel, a região e os diferenciais que não cabem nos campos acima."
              rows={5}
            />
          </Campo>
        </div>
      </SecaoFormulario>

      {/* ---------------- 2. Localização ---------------- */}
      <SecaoFormulario
        id="secao-localizacao"
        icone={MapPin}
        titulo="Localização"
        descricao="Bairro e cidade alimentam os filtros do site."
        comErro={secoesComErro.localizacao}
      >
        <div className="grid gap-5 sm:grid-cols-6">
          <Campo
            id="cep"
            rotulo="CEP"
            className="sm:col-span-2"
            dica="Preencha e saia do campo para buscar o endereço."
          >
            <div className="relative">
              <Input
                id="cep"
                value={formulario.cep}
                onChange={(e) => definir('cep', mascararCep(e.target.value))}
                onBlur={() => void aoSairDoCep()}
                placeholder="00000-000"
                inputMode="numeric"
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-destaque" />
              )}
            </div>
          </Campo>

          <Campo id="endereco" rotulo="Endereço" className="sm:col-span-4">
            <Input
              id="endereco"
              value={formulario.endereco}
              onChange={(e) => definir('endereco', e.target.value)}
              placeholder="Rua das Acácias"
            />
          </Campo>

          <Campo id="numero" rotulo="Número" className="sm:col-span-2">
            <Input
              id="numero"
              value={formulario.numero}
              onChange={(e) => definir('numero', e.target.value)}
              placeholder="128"
            />
          </Campo>

          <Campo id="complemento" rotulo="Complemento" className="sm:col-span-4">
            <Input
              id="complemento"
              value={formulario.complemento}
              onChange={(e) => definir('complemento', e.target.value)}
              placeholder="Apto 42, bloco B"
            />
          </Campo>

          <Campo
            id="bairro"
            rotulo="Bairro"
            obrigatorio
            erro={erros.bairro}
            className="sm:col-span-2"
          >
            <Input
              id="bairro"
              value={formulario.bairro}
              onChange={(e) => definir('bairro', e.target.value)}
              aria-invalid={Boolean(erros.bairro)}
              placeholder="Jardim Europa"
            />
          </Campo>

          <Campo
            id="cidade"
            rotulo="Cidade"
            obrigatorio
            erro={erros.cidade}
            className="sm:col-span-2"
          >
            <Input
              id="cidade"
              value={formulario.cidade}
              onChange={(e) => definir('cidade', e.target.value)}
              aria-invalid={Boolean(erros.cidade)}
              placeholder="São Paulo"
            />
          </Campo>

          <Campo
            id="estado"
            rotulo="Estado"
            obrigatorio
            erro={erros.estado}
            className="sm:col-span-2"
          >
            <Select
              id="estado"
              value={formulario.estado}
              onChange={(e) => definir('estado', e.target.value)}
              aria-invalid={Boolean(erros.estado)}
            >
              <option value="">UF</option>
              {ESTADOS_BRASIL.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      </SecaoFormulario>

      {/* ---------------- 3. Valores ---------------- */}
      <SecaoFormulario
        id="secao-valores"
        icone={Banknote}
        titulo="Valores"
        descricao="Os campos obrigatórios dependem da finalidade escolhida."
        comErro={secoesComErro.valores}
      >
        {!formulario.finalidade ? (
          <p className="rounded-lg border border-dashed border-borda-forte bg-superficie-alternativa px-4 py-6 text-center text-sm text-texto-suave">
            Escolha a finalidade na seção Identificação para ver os campos de valor.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {mostraVenda && (
              <Campo
                id="valor_venda"
                rotulo="Valor de venda"
                obrigatorio
                erro={erros.valor_venda}
              >
                <CampoMoeda
                  id="valor_venda"
                  valor={formulario.valor_venda}
                  aoMudar={(v) => definir('valor_venda', v)}
                  invalido={Boolean(erros.valor_venda)}
                />
              </Campo>
            )}

            {mostraAluguel && (
              <Campo
                id="valor_aluguel"
                rotulo="Valor do aluguel"
                obrigatorio
                erro={erros.valor_aluguel}
                dica="Valor mensal."
              >
                <CampoMoeda
                  id="valor_aluguel"
                  valor={formulario.valor_aluguel}
                  aoMudar={(v) => definir('valor_aluguel', v)}
                  invalido={Boolean(erros.valor_aluguel)}
                />
              </Campo>
            )}

            <Campo id="valor_condominio" rotulo="Condomínio">
              <CampoMoeda
                id="valor_condominio"
                valor={formulario.valor_condominio}
                aoMudar={(v) => definir('valor_condominio', v)}
              />
            </Campo>

            <Campo id="valor_iptu" rotulo="IPTU">
              <CampoMoeda
                id="valor_iptu"
                valor={formulario.valor_iptu}
                aoMudar={(v) => definir('valor_iptu', v)}
              />
            </Campo>
          </div>
        )}
      </SecaoFormulario>

      {/* ---------------- 4. Características ---------------- */}
      <SecaoFormulario
        id="secao-caracteristicas"
        icone={Ruler}
        titulo="Características"
        descricao="Metragem, cômodos e diferenciais. Alimentam os filtros e a busca da API."
      >
        <div className="flex flex-col gap-7">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Campo id="area_total" rotulo="Área total (m²)">
              <Input
                id="area_total"
                inputMode="decimal"
                value={formulario.area_total}
                onChange={(e) => definir('area_total', e.target.value)}
                placeholder="250"
              />
            </Campo>

            <Campo id="area_util" rotulo="Área útil (m²)">
              <Input
                id="area_util"
                inputMode="decimal"
                value={formulario.area_util}
                onChange={(e) => definir('area_util', e.target.value)}
                placeholder="180"
              />
            </Campo>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['quartos', 'Quartos'],
                ['suites', 'Suítes'],
                ['banheiros', 'Banheiros'],
                ['vagas', 'Vagas'],
              ] as const
            ).map(([campo, rotulo]) => (
              <Campo key={campo} id={campo} rotulo={rotulo}>
                <Contador
                  id={campo}
                  valor={formulario[campo]}
                  aoMudar={(v) => definir(campo, v)}
                />
              </Campo>
            ))}
          </div>

          <div className="flex flex-wrap gap-8">
            <div className="flex items-center gap-3">
              <Alternador
                id="mobiliado"
                marcado={formulario.mobiliado}
                aoMudar={(v) => definir('mobiliado', v)}
              />
              <Label htmlFor="mobiliado" className="cursor-pointer">
                Mobiliado
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Alternador
                id="aceita_pet"
                marcado={formulario.aceita_pet}
                aoMudar={(v) => definir('aceita_pet', v)}
              />
              <Label htmlFor="aceita_pet" className="cursor-pointer">
                Aceita pet
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-borda pt-6">
            <Label>Diferenciais</Label>
            <SeletorCaracteristicas
              valor={formulario.caracteristicas}
              aoMudar={(v) => definir('caracteristicas', v)}
            />
          </div>
        </div>
      </SecaoFormulario>

      {/* ---------------- 5. Fotos ---------------- */}
      <SecaoFormulario
        id="secao-fotos"
        icone={Images}
        titulo="Fotos"
        descricao="Até 10 fotos. A capa é a imagem que aparece na vitrine e nos cards."
      >
        <GerenciadorFotos fotos={fotos} aoMudar={setFotos} />
      </SecaoFormulario>

      {/* ---------------- 6. Proprietário ---------------- */}
      <SecaoFormulario
        id="secao-proprietario"
        icone={UserRound}
        titulo="Proprietário"
        descricao="Uso interno. Nunca aparece no site público nem em endpoint público da API."
        acao={
          <Button
            variante="secundario"
            tamanho="pequeno"
            onClick={() => setProprietarioAberto((v) => !v)}
          >
            {proprietarioAberto ? 'Recolher' : 'Preencher'}
            <ChevronDown
              className={cn('size-4 transition-transform', proprietarioAberto && 'rotate-180')}
            />
          </Button>
        }
      >
        {proprietarioAberto ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo id="proprietario_nome" rotulo="Nome do proprietário">
              <Input
                id="proprietario_nome"
                value={formulario.proprietario_nome}
                onChange={(e) => definir('proprietario_nome', e.target.value)}
                placeholder="Maria Oliveira"
              />
            </Campo>

            <Campo id="proprietario_contato" rotulo="Contato do proprietário">
              <Input
                id="proprietario_contato"
                value={formulario.proprietario_contato}
                onChange={(e) => definir('proprietario_contato', e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </Campo>
          </div>
        ) : (
          <p className="text-sm text-texto-suave">
            Opcional. Preencha depois se o dado não estiver em mãos agora.
          </p>
        )}
      </SecaoFormulario>

      {/* ---------------- Barra fixa de ações ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-superficie/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3">
          <p className="text-sm text-texto-suave">
            {sujo ? 'Há alterações não salvas.' : 'Tudo salvo.'}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variante="secundario"
              onClick={() => navegar('/painel/imoveis')}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {salvando ? 'Salvando…' : 'Salvar imóvel'}
            </Button>
          </div>
        </div>
      </div>

      {/* ---------------- Aviso de saída ---------------- */}
      <AlertDialog
        open={bloqueio.state === 'blocked'}
        onOpenChange={(aberto) => !aberto && bloqueio.reset?.()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações feitas neste imóvel serão perdidas. As fotos que você adicionou
              ainda não foram enviadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variante="secundario" onClick={() => bloqueio.reset?.()}>
              Continuar editando
            </Button>
            <Button variante="destrutivo" onClick={() => bloqueio.proceed?.()}>
              Sair sem salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------------------------------------------------------------- apoio */

function CampoMoeda({
  id,
  valor,
  aoMudar,
  invalido,
}: {
  id: string
  valor: string
  aoMudar: (valor: string) => void
  invalido?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-texto-tenue">
        R$
      </span>
      <Input
        id={id}
        inputMode="numeric"
        value={valor}
        onChange={(e) => aoMudar(mascararMoeda(e.target.value))}
        placeholder="0,00"
        aria-invalid={invalido}
        className="pl-10"
      />
    </div>
  )
}

function paraFormulario(imovel: Imovel): EstadoFormulario {
  return {
    titulo: imovel.titulo,
    id_tipo_imovel: imovel.id_tipo_imovel,
    finalidade: imovel.finalidade,
    descricao: imovel.descricao ?? '',
    cep: imovel.cep ?? '',
    endereco: imovel.endereco ?? '',
    numero: imovel.numero ?? '',
    complemento: imovel.complemento ?? '',
    bairro: imovel.bairro,
    cidade: imovel.cidade,
    estado: imovel.estado,
    valor_venda: numeroParaMoeda(imovel.valor_venda),
    valor_aluguel: numeroParaMoeda(imovel.valor_aluguel),
    valor_condominio: numeroParaMoeda(imovel.valor_condominio),
    valor_iptu: numeroParaMoeda(imovel.valor_iptu),
    area_total: imovel.area_total === null ? '' : String(imovel.area_total).replace('.', ','),
    area_util: imovel.area_util === null ? '' : String(imovel.area_util).replace('.', ','),
    quartos: imovel.quartos,
    suites: imovel.suites,
    banheiros: imovel.banheiros,
    vagas: imovel.vagas,
    mobiliado: imovel.mobiliado,
    aceita_pet: imovel.aceita_pet,
    caracteristicas: Array.isArray(imovel.caracteristicas)
      ? (imovel.caracteristicas as string[])
      : [],
    proprietario_nome: imovel.proprietario_nome ?? '',
    proprietario_contato: imovel.proprietario_contato ?? '',
  }
}

function paraBanco(formulario: EstadoFormulario): DadosImovel {
  const vazioParaNulo = (texto: string) => (texto.trim() ? texto.trim() : null)

  return {
    titulo: formulario.titulo.trim(),
    id_tipo_imovel: formulario.id_tipo_imovel,
    finalidade: formulario.finalidade,
    descricao: vazioParaNulo(formulario.descricao),
    cep: vazioParaNulo(formulario.cep),
    endereco: vazioParaNulo(formulario.endereco),
    numero: vazioParaNulo(formulario.numero),
    complemento: vazioParaNulo(formulario.complemento),
    bairro: formulario.bairro.trim(),
    cidade: formulario.cidade.trim(),
    estado: formulario.estado,
    valor_venda: moedaParaNumero(formulario.valor_venda),
    valor_aluguel: moedaParaNumero(formulario.valor_aluguel),
    valor_condominio: moedaParaNumero(formulario.valor_condominio),
    valor_iptu: moedaParaNumero(formulario.valor_iptu),
    area_total: textoParaNumero(formulario.area_total),
    area_util: textoParaNumero(formulario.area_util),
    quartos: formulario.quartos,
    suites: formulario.suites,
    banheiros: formulario.banheiros,
    vagas: formulario.vagas,
    mobiliado: formulario.mobiliado,
    aceita_pet: formulario.aceita_pet,
    caracteristicas: formulario.caracteristicas.length > 0 ? formulario.caracteristicas : null,
    proprietario_nome: vazioParaNulo(formulario.proprietario_nome),
    proprietario_contato: vazioParaNulo(formulario.proprietario_contato),
  }
}

/** Assinatura do estado, para detectar alterações não salvas. */
function assinar(formulario: EstadoFormulario, fotos: FotoEmEdicao[]): string {
  return JSON.stringify([
    formulario,
    fotos.map((foto) => [foto.id ?? foto.chave, foto.capa]),
  ])
}

function secaoDoPrimeiroErro(erros: Erros): string {
  if (erros.titulo || erros.id_tipo_imovel || erros.finalidade) return 'secao-identificacao'
  if (erros.bairro || erros.cidade || erros.estado) return 'secao-localizacao'
  return 'secao-valores'
}
