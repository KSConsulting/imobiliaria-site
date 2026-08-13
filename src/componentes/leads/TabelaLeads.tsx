import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { BadgeStatus } from '@/componentes/leads/BadgeStatus'
import {
  formatarWhatsapp,
  nomeExibido,
  resumirInteresse,
  type ColunaOrdenacao,
  type LeadComImovel,
  type Ordenacao,
} from '@/lib/leads'
import { formatarData, tempoRelativo } from '@/lib/datas'
import { formatarMoedaCurta } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  leads: LeadComImovel[]
  fuso: string
  ordenacao: Ordenacao
  ordenarPor: (coluna: ColunaOrdenacao) => void
  aoAbrir: (lead: LeadComImovel) => void
  aoEditar: (lead: LeadComImovel) => void
  aoExcluir: (lead: LeadComImovel) => void
}

const COLUNAS: { chave: ColunaOrdenacao | null; rotulo: string; classe?: string }[] = [
  { chave: 'nome', rotulo: 'Lead' },
  { chave: 'status', rotulo: 'Etapa' },
  { chave: 'origem', rotulo: 'Origem', classe: 'hidden xl:table-cell' },
  { chave: null, rotulo: 'Imóvel', classe: 'hidden lg:table-cell' },
  { chave: null, rotulo: 'Interesse', classe: 'hidden xl:table-cell' },
  { chave: 'ultima_mensagem', rotulo: 'Última mensagem', classe: 'hidden md:table-cell' },
  { chave: 'created_at', rotulo: 'Entrada', classe: 'hidden sm:table-cell' },
]

/**
 * Leads em tabela, e não em cards como os Imóveis.
 *
 * A comparação aqui é textual — quem respondeu, em que etapa está, há
 * quanto tempo sumiu. Card com foto serve para escolher um imóvel; para
 * varrer trinta contatos atrás do que esfriou, o que serve é densidade e
 * colunas alinhadas.
 */
export function TabelaLeads({
  leads,
  fuso,
  ordenacao,
  ordenarPor,
  aoAbrir,
  aoEditar,
  aoExcluir,
}: Props) {
  return (
    <div className="cartao overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda bg-superficie-alternativa">
              {COLUNAS.map(({ chave, rotulo, classe }) => (
                <th
                  key={rotulo}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-texto-suave whitespace-nowrap',
                    classe,
                  )}
                  aria-sort={
                    chave && ordenacao.coluna === chave
                      ? ordenacao.ascendente
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {chave ? (
                    <button
                      type="button"
                      onClick={() => ordenarPor(chave)}
                      className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-texto"
                    >
                      {rotulo}
                      <Seta ativa={ordenacao.coluna === chave} ascendente={ordenacao.ascendente} />
                    </button>
                  ) : (
                    rotulo
                  )}
                </th>
              ))}
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-borda">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => aoAbrir(lead)}
                className="cursor-pointer transition-colors hover:bg-superficie-alternativa"
              >
                {/* Lead: nome com o WhatsApp abaixo. Sem nome, o número
                    sobe para a linha principal — o agente cria o lead
                    pelo número antes de saber o nome, então a célula em
                    branco seria o caso comum. */}
                <td className="px-4 py-3">
                  <span className="block font-medium text-texto">{nomeExibido(lead)}</span>
                  {lead.nome?.trim() && (
                    <span className="block text-xs text-texto-suave">
                      {formatarWhatsapp(lead.whatsapp)}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <BadgeStatus status={lead.status} />
                </td>

                <td className="hidden px-4 py-3 text-texto-suave xl:table-cell">
                  {lead.origem ?? '—'}
                </td>

                <td className="hidden px-4 py-3 lg:table-cell">
                  {!lead.codigo_imovel_interesse ? (
                    <span className="text-texto-tenue">—</span>
                  ) : lead.imovel_interesse ? (
                    <Link
                      to={`/painel/imoveis/${lead.imovel_interesse.id}/editar`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-destaque hover:underline"
                    >
                      {lead.imovel_interesse.codigo}
                    </Link>
                  ) : (
                    <span
                      className="text-texto-tenue"
                      title="Este imóvel não está mais cadastrado."
                    >
                      {lead.codigo_imovel_interesse}
                    </span>
                  )}
                </td>

                <td className="hidden max-w-56 truncate px-4 py-3 text-texto-suave xl:table-cell">
                  {resumirInteresse(lead, formatarMoedaCurta) || '—'}
                </td>

                <td className="hidden px-4 py-3 text-texto-suave whitespace-nowrap md:table-cell">
                  {tempoRelativo(lead.ultima_mensagem)}
                </td>

                <td className="hidden px-4 py-3 text-texto-suave whitespace-nowrap sm:table-cell">
                  {formatarData(new Date(lead.created_at), fuso)}
                </td>

                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Ações de ${nomeExibido(lead)}`}
                        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-superficie hover:text-texto"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => aoAbrir(lead)}>
                        Abrir ficha
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => aoEditar(lead)}>
                        <Pencil className="size-4" />
                        Editar dados
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variante="destrutivo" onSelect={() => aoExcluir(lead)}>
                        <Trash2 className="size-4" />
                        Excluir lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Seta({ ativa, ascendente }: { ativa: boolean; ascendente: boolean }) {
  if (!ativa) return <ChevronsUpDown className="size-3.5 text-texto-tenue" aria-hidden />
  return ascendente ? (
    <ArrowUp className="size-3.5 text-destaque" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5 text-destaque" aria-hidden />
  )
}
