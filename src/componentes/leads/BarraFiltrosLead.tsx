import { Search, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Select } from '@/componentes/ui/select'
import { ETAPAS_FUNIL, statusSelecionados, type FiltrosLead } from '@/lib/leads'
import { cn } from '@/lib/utils'

interface Props {
  filtros: FiltrosLead
  definirFiltro: (chave: keyof FiltrosLead, valor: string) => void
  alternarStatus: (status: string) => void
  limparFiltros: () => void
  origens: string[]
  temFiltro: boolean
  /**
   * Versão do Funil: sem status e sem tipo.
   *
   * As colunas já são o status, e um filtro que repete a estrutura da
   * tela só ocupa espaço. O tipo sai junto porque, no Kanban, quem se
   * interessa por lead contra cliente está olhando para a coluna
   * "Visitou" — que é onde o banco faz a promoção.
   */
  compacta?: boolean
}

export function BarraFiltrosLead({
  filtros,
  definirFiltro,
  alternarStatus,
  limparFiltros,
  origens,
  temFiltro,
  compacta = false,
}: Props) {
  const marcados = statusSelecionados(filtros)

  return (
    <div className="cartao flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
          <Input
            value={filtros.busca}
            onChange={(e) => definirFiltro('busca', e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou código do imóvel"
            className="pl-10"
            aria-label="Buscar leads"
          />
          {filtros.busca && (
            <button
              type="button"
              onClick={() => definirFiltro('busca', '')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-texto-tenue hover:text-texto"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:w-auto">
          <Select
            value={filtros.origem}
            onChange={(e) => definirFiltro('origem', e.target.value)}
            aria-label="Origem"
            className="lg:w-40"
          >
            <option value="">Toda origem</option>
            {origens.map((origem) => (
              <option key={origem} value={origem}>
                {origem}
              </option>
            ))}
          </Select>

          <Select
            value={filtros.finalidade}
            onChange={(e) => definirFiltro('finalidade', e.target.value)}
            aria-label="Finalidade de interesse"
            className="lg:w-40"
          >
            <option value="">Todo interesse</option>
            <option value="venda">Compra</option>
            <option value="locacao">Locação</option>
          </Select>

          {!compacta && (
            <Select
              value={filtros.tipo}
              onChange={(e) => definirFiltro('tipo', e.target.value)}
              aria-label="Tipo de contato"
              className="lg:w-36"
            >
              <option value="">Todos</option>
              <option value="lead">Leads</option>
              <option value="cliente">Clientes</option>
            </Select>
          )}
        </div>
      </div>

      {/* Período de entrada */}
      <div className="flex flex-wrap items-end gap-3 border-t border-borda pt-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-de" className="text-xs text-texto-suave">
            Entrada de
          </Label>
          <Input
            id="lead-de"
            type="date"
            value={filtros.de}
            onChange={(e) => definirFiltro('de', e.target.value)}
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead-ate" className="text-xs text-texto-suave">
            até
          </Label>
          <Input
            id="lead-ate"
            type="date"
            value={filtros.ate}
            onChange={(e) => definirFiltro('ate', e.target.value)}
            className="w-44"
          />
        </div>

        {temFiltro && (
          <Button variante="fantasma" tamanho="pequeno" onClick={limparFiltros} className="ml-auto">
            <X className="size-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Status em seleção múltipla, só na tela de Leads */}
      {!compacta && (
        <div className="flex flex-col gap-2 border-t border-borda pt-4">
          <span className="rotulo-grupo">Etapa do funil</span>
          <div className="flex flex-wrap gap-2">
            {ETAPAS_FUNIL.map((etapa) => {
              const ativo = marcados.includes(etapa.chave)
              return (
                <button
                  key={etapa.chave}
                  type="button"
                  onClick={() => alternarStatus(etapa.chave)}
                  aria-pressed={ativo}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    ativo
                      ? cn(etapa.badge, 'border-transparent')
                      : 'border-borda-forte bg-superficie text-texto-suave hover:text-texto',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', etapa.ponto)} aria-hidden />
                  {etapa.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
