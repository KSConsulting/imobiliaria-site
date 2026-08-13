import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, UserRoundCheck } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Select } from '@/componentes/ui/select'
import { Textarea } from '@/componentes/ui/textarea'
import { Campo } from '@/componentes/SecaoFormulario'
import { CampoWhatsapp } from '@/componentes/CampoWhatsapp'
import { separarWhatsapp, validarWhatsapp } from '@/lib/telefone'
import {
  atualizarLead,
  buscarLeadPorWhatsapp,
  criarLead,
  ehErroDeDuplicidade,
  nomeExibido,
  type DadosLead,
  type Lead,
} from '@/lib/leads'
import { listarTiposImovel, type TipoImovel } from '@/lib/imoveis'
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '@/lib/formato'
import { notificar } from '@/lib/notificacoes'

interface Props {
  aberto: boolean
  aoFechar: () => void
  /** Lead em edição. Nulo no cadastro. */
  lead: Lead | null
  aoSalvar: () => void
  /** Abre a ficha do lead que já existia com aquele WhatsApp. */
  aoAbrirExistente: (id: string) => void
}

const ORIGENS_SUGERIDAS = ['Site', 'WhatsApp', 'Indicação', 'Portal', 'Telefone', 'Painel']

const VAZIO = {
  whatsapp: '',
  nome: '',
  email: '',
  origem: '',
  finalidade: '',
  tipoImovel: '',
  valorMin: '',
  valorMax: '',
  observacoes: '',
}

/**
 * Cadastro manual de lead.
 *
 * Curto de propósito: preencher a ficha inteira é papel do agente de IA,
 * que conversa com a pessoa. Aqui o caso é o telefone que tocou — e um
 * formulário de quinze campos faria o atendente anotar no papel.
 *
 * Só o WhatsApp é obrigatório, porque é a chave natural do lead e a
 * única coisa que sempre se tem quando alguém liga.
 */
export function ModalLead({ aberto, aoFechar, lead, aoSalvar, aoAbrirExistente }: Props) {
  const editando = Boolean(lead)

  const [campos, setCampos] = useState({ ...VAZIO })
  const [tipos, setTipos] = useState<TipoImovel[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erroWhatsapp, setErroWhatsapp] = useState<string | undefined>()
  const [duplicado, setDuplicado] = useState<Lead | null>(null)

  useEffect(() => {
    if (!aberto) return

    setErroWhatsapp(undefined)
    setDuplicado(null)
    setCampos(
      lead
        ? {
            whatsapp: lead.whatsapp,
            nome: lead.nome ?? '',
            email: lead.email ?? '',
            origem: lead.origem ?? '',
            finalidade: lead.finalidade_interesse ?? '',
            tipoImovel: lead.tipo_imovel_interesse ?? '',
            valorMin: lead.faixa_valor_min !== null ? numeroParaMoeda(lead.faixa_valor_min) : '',
            valorMax: lead.faixa_valor_max !== null ? numeroParaMoeda(lead.faixa_valor_max) : '',
            observacoes: lead.observacoes ?? '',
          }
        : { ...VAZIO },
    )
  }, [aberto, lead])

  useEffect(() => {
    if (!aberto || tipos.length > 0) return
    void (async () => {
      try {
        setTipos(await listarTiposImovel())
      } catch (erro) {
        console.warn('[leads] falha ao carregar tipos de imóvel:', erro)
      }
    })()
  }, [aberto, tipos.length])

  function definir(chave: keyof typeof VAZIO, valor: string) {
    setCampos((atuais) => ({ ...atuais, [chave]: valor }))
    if (chave === 'whatsapp') {
      setErroWhatsapp(undefined)
      setDuplicado(null)
    }
  }

  function montarDados(): DadosLead {
    return {
      whatsapp: campos.whatsapp.replace(/\D/g, ''),
      nome: campos.nome.trim() || null,
      email: campos.email.trim() || null,
      origem: campos.origem.trim() || null,
      finalidade_interesse: campos.finalidade || null,
      tipo_imovel_interesse: campos.tipoImovel || null,
      faixa_valor_min: moedaParaNumero(campos.valorMin),
      faixa_valor_max: moedaParaNumero(campos.valorMax),
      observacoes: campos.observacoes.trim() || null,
    }
  }

  async function salvar() {
    const numero = campos.whatsapp.replace(/\D/g, '')
    const { pais, nacional } = separarWhatsapp(numero)
    const invalido = validarWhatsapp(pais, nacional)
    if (invalido) {
      setErroWhatsapp(invalido)
      return
    }

    const dados = montarDados()
    setSalvando(true)

    try {
      if (lead) {
        // Na edição o número pode ter mudado, e o novo pode pertencer a
        // outro cadastro. A checagem prévia é a mesma; o que muda é que
        // o próprio lead não conta como duplicidade.
        if (numero !== lead.whatsapp) {
          const existente = await buscarLeadPorWhatsapp(numero)
          if (existente && existente.id !== lead.id) {
            setDuplicado(existente)
            return
          }
        }
        await atualizarLead(lead, dados)
        notificar.sucesso('Lead atualizado')
      } else {
        // Checagem antes do insert para poder oferecer o cadastro
        // existente em vez de devolver um erro de banco. O 23505 abaixo
        // continua sendo tratado: entre esta consulta e o insert, o
        // agente de IA pode ter criado o mesmo número.
        const existente = await buscarLeadPorWhatsapp(numero)
        if (existente) {
          setDuplicado(existente)
          return
        }

        await criarLead(dados)
        notificar.sucesso('Lead cadastrado')
      }

      aoSalvar()
      aoFechar()
    } catch (erro) {
      if (ehErroDeDuplicidade(erro)) {
        const existente = await buscarLeadPorWhatsapp(numero).catch(() => null)
        if (existente) {
          setDuplicado(existente)
          return
        }
      }
      notificar.erroDoBanco(erro, 'Não foi possível salvar o lead.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar lead' : 'Novo lead'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Os campos preenchidos pelo agente de IA continuam na ficha do lead.'
              : 'Só o WhatsApp é obrigatório — o resto pode ser completado depois, inclusive pelo agente.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          {/* Duplicidade: informa e oferece o caminho, em vez de errar.
              Quem está aqui quer registrar aquela pessoa, e ela já está
              cadastrada — a resposta útil é abrir o cadastro dela. */}
          {duplicado && (
            <div className="flex flex-col gap-3 rounded-lg border border-destaque/35 bg-destaque-suave px-4 py-3.5">
              <div className="flex items-start gap-3">
                <UserRoundCheck className="mt-0.5 size-4.5 shrink-0 text-destaque" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-texto">
                    Este contato já está cadastrado
                  </p>
                  <p className="mt-0.5 text-sm text-texto-suave">
                    <strong className="text-texto">{nomeExibido(duplicado)}</strong> já existe no
                    CRM. O WhatsApp identifica o lead, então não existem dois registros para o
                    mesmo número.
                  </p>
                </div>
              </div>
              <Button
                tamanho="pequeno"
                className="self-start"
                onClick={() => {
                  aoFechar()
                  aoAbrirExistente(duplicado.id)
                }}
              >
                Abrir cadastro existente
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}

          <Campo
            id="lead-whatsapp"
            rotulo="WhatsApp"
            obrigatorio
            erro={erroWhatsapp}
            dica="Identifica o lead. Um número, um cadastro."
          >
            <CampoWhatsapp
              id="lead-whatsapp"
              valor={campos.whatsapp}
              aoMudar={(v) => definir('whatsapp', v)}
              erro={duplicado ? 'Este número já tem cadastro.' : undefined}
              autoFocus={!editando}
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="lead-nome" rotulo="Nome">
              <Input
                id="lead-nome"
                value={campos.nome}
                onChange={(e) => definir('nome', e.target.value)}
                placeholder="Como o cliente se apresentou"
              />
            </Campo>

            <Campo id="lead-email" rotulo="Email">
              <Input
                id="lead-email"
                type="email"
                value={campos.email}
                onChange={(e) => definir('email', e.target.value)}
                placeholder="cliente@email.com"
              />
            </Campo>
          </div>

          <Campo id="lead-origem" rotulo="Origem" dica="De onde veio o contato.">
            <Input
              id="lead-origem"
              list="origens-sugeridas"
              value={campos.origem}
              onChange={(e) => definir('origem', e.target.value)}
              placeholder="Site, indicação, portal…"
            />
            <datalist id="origens-sugeridas">
              {ORIGENS_SUGERIDAS.map((origem) => (
                <option key={origem} value={origem} />
              ))}
            </datalist>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="lead-finalidade" rotulo="Procura por">
              <Select
                id="lead-finalidade"
                value={campos.finalidade}
                onChange={(e) => definir('finalidade', e.target.value)}
              >
                <option value="">Não informado</option>
                <option value="venda">Compra</option>
                <option value="locacao">Locação</option>
              </Select>
            </Campo>

            <Campo id="lead-tipo-imovel" rotulo="Tipo de imóvel">
              <Select
                id="lead-tipo-imovel"
                value={campos.tipoImovel}
                onChange={(e) => definir('tipoImovel', e.target.value)}
              >
                <option value="">Não informado</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.nome}>
                    {tipo.nome}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="lead-valor-min" rotulo="Valor mínimo">
              <Input
                id="lead-valor-min"
                inputMode="numeric"
                value={campos.valorMin}
                onChange={(e) => definir('valorMin', mascararMoeda(e.target.value))}
                placeholder="R$ 0,00"
              />
            </Campo>

            <Campo id="lead-valor-max" rotulo="Valor máximo">
              <Input
                id="lead-valor-max"
                inputMode="numeric"
                value={campos.valorMax}
                onChange={(e) => definir('valorMax', mascararMoeda(e.target.value))}
                placeholder="R$ 0,00"
              />
            </Campo>
          </div>

          <Campo id="lead-observacoes" rotulo="Observações">
            <Textarea
              id="lead-observacoes"
              value={campos.observacoes}
              onChange={(e) => definir('observacoes', e.target.value)}
              placeholder="O que a equipe precisa saber sobre este contato."
              rows={3}
            />
          </Campo>
        </DialogBody>

        <DialogFooter>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
