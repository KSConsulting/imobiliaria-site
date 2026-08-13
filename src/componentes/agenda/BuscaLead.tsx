import { useEffect, useState } from 'react'
import { Check, Loader2, Plus, Search, UserRound, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { CampoWhatsapp } from '@/componentes/CampoWhatsapp'
import { buscarLeads, criarLeadRapido, type LeadResumo } from '@/lib/agendamentos'
import { separarWhatsapp, validarWhatsapp } from '@/lib/telefone'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

interface Props {
  selecionado: LeadResumo | null
  aoSelecionar: (lead: LeadResumo | null) => void
  invalido?: boolean
}

/**
 * Busca de lead com cadastro rápido embutido.
 *
 * O cadastro no meio do fluxo existe porque a visita quase sempre é
 * marcada durante a ligação: obrigar a sair para a tela de Leads,
 * cadastrar e voltar faria o corretor perder o cliente na linha.
 *
 * O cadastro usa upsert por `whatsapp`, então digitar um número que já
 * existe aproveita o lead em vez de estourar erro de duplicidade.
 */
export function BuscaLead({ selecionado, aoSelecionar, invalido }: Props) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<LeadResumo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [novoWhatsapp, setNovoWhatsapp] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  useEffect(() => {
    if (selecionado || criando) return

    let ativo = true
    setBuscando(true)
    const tempo = setTimeout(async () => {
      try {
        const lista = await buscarLeads(termo)
        if (ativo) setResultados(lista)
      } catch {
        if (ativo) setResultados([])
      } finally {
        if (ativo) setBuscando(false)
      }
    }, 250)

    return () => {
      ativo = false
      clearTimeout(tempo)
    }
  }, [termo, selecionado, criando])

  async function cadastrar() {
    // A régua é a do país escolhido no campo, não um mínimo fixo.
    const { pais, nacional } = separarWhatsapp(novoWhatsapp)
    const invalido = validarWhatsapp(pais, nacional)
    if (invalido) {
      notificar.erro('WhatsApp inválido', invalido)
      return
    }

    setSalvandoNovo(true)
    try {
      const lead = await criarLeadRapido(novoWhatsapp, novoNome)
      aoSelecionar(lead)
      setCriando(false)
      setNovoWhatsapp('')
      setNovoNome('')
      notificar.sucesso('Lead disponível', lead.nome ?? lead.whatsapp)
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível cadastrar o lead.')
    } finally {
      setSalvandoNovo(false)
    }
  }

  if (selecionado) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destaque bg-destaque-suave px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserRound className="size-4 shrink-0 text-destaque" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-texto">
              {selecionado.nome ?? 'Sem nome'}
            </p>
            <p className="truncate text-xs text-texto-suave">{selecionado.whatsapp}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => aoSelecionar(null)}
          aria-label="Trocar lead"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-texto-suave transition-colors hover:bg-superficie hover:text-texto"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  if (criando) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie-alternativa p-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="novo-whatsapp" className="text-xs">
            WhatsApp <span className="text-destrutivo">*</span>
          </Label>
          <CampoWhatsapp
            id="novo-whatsapp"
            valor={novoWhatsapp}
            aoMudar={setNovoWhatsapp}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="novo-nome" className="text-xs">
            Nome
          </Label>
          <Input
            id="novo-nome"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Como o cliente se apresentou"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variante="secundario"
            tamanho="pequeno"
            onClick={() => setCriando(false)}
            disabled={salvandoNovo}
          >
            Voltar à busca
          </Button>
          <Button tamanho="pequeno" onClick={() => void cadastrar()} disabled={salvandoNovo}>
            {salvandoNovo ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Usar este lead
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou WhatsApp"
          className="pl-10"
          aria-invalid={invalido}
        />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-texto-tenue" />
        )}
      </div>

      <div className="max-h-44 overflow-y-auto rounded-lg border border-borda">
        {resultados.length === 0 ? (
          <p className="px-3.5 py-4 text-center text-sm text-texto-tenue">
            {termo ? 'Nenhum lead encontrado com esse termo.' : 'Nenhum lead cadastrado ainda.'}
          </p>
        ) : (
          <ul className="divide-y divide-borda">
            {resultados.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => aoSelecionar(lead)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-superficie-alternativa',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-texto">
                      {lead.nome ?? 'Sem nome'}
                    </span>
                    <span className="block truncate text-xs text-texto-suave">
                      {lead.whatsapp}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-texto-tenue">{lead.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variante="secundario" tamanho="pequeno" onClick={() => setCriando(true)}>
        <Plus className="size-3.5" />
        Cadastrar lead novo
      </Button>
    </div>
  )
}
