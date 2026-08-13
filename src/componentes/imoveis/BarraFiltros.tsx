import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Select } from '@/componentes/ui/select'
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '@/lib/formato'
import type { FiltrosImovel, TipoImovel } from '@/lib/imoveis'
import { cn } from '@/lib/utils'

interface Props {
  filtros: FiltrosImovel
  definirFiltro: (chave: keyof FiltrosImovel, valor: string) => void
  limparFiltros: () => void
  tipos: TipoImovel[]
  cidades: string[]
  bairros: string[]
  temFiltro: boolean
}

export function BarraFiltros({
  filtros,
  definirFiltro,
  limparFiltros,
  tipos,
  cidades,
  bairros,
  temFiltro,
}: Props) {
  const [avancadosAbertos, setAvancadosAbertos] = useState(false)

  // Filtros avançados já aplicados não podem ficar escondidos: quem
  // abre um link filtrado precisa enxergar o que está filtrando.
  useEffect(() => {
    if (
      filtros.cidade ||
      filtros.bairro ||
      filtros.valorMin ||
      filtros.valorMax ||
      filtros.quartos ||
      filtros.vagas
    ) {
      setAvancadosAbertos(true)
    }
  }, [filtros.cidade, filtros.bairro, filtros.valorMin, filtros.valorMax, filtros.quartos, filtros.vagas])

  return (
    <div className="cartao flex flex-col gap-4 p-4">
      {/* ---------- Linha principal ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-texto-tenue" />
          <Input
            value={filtros.busca}
            onChange={(e) => definirFiltro('busca', e.target.value)}
            placeholder="Buscar por código, título, bairro ou cidade"
            className="pl-10"
            aria-label="Buscar imóveis"
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
          <Select
            value={filtros.finalidade}
            onChange={(e) => definirFiltro('finalidade', e.target.value)}
            aria-label="Finalidade"
            className="lg:w-40"
          >
            <option value="">Toda finalidade</option>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
          </Select>

          <Select
            value={filtros.tipo}
            onChange={(e) => definirFiltro('tipo', e.target.value)}
            aria-label="Tipo de imóvel"
            className="lg:w-44"
          >
            <option value="">Todos os tipos</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </Select>

          <Select
            value={filtros.status}
            onChange={(e) => definirFiltro('status', e.target.value)}
            aria-label="Status"
            className="lg:w-36"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </Select>

          <Button
            variante="secundario"
            onClick={() => setAvancadosAbertos((v) => !v)}
            className={cn('col-span-2 sm:col-span-1', avancadosAbertos && 'border-destaque text-destaque')}
          >
            <SlidersHorizontal className="size-4" />
            Mais filtros
          </Button>
        </div>
      </div>

      {/* ---------- Filtros avançados ---------- */}
      {avancadosAbertos && (
        <div className="grid gap-4 border-t border-borda pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Cidade" id="filtro-cidade">
            <Select
              id="filtro-cidade"
              value={filtros.cidade}
              onChange={(e) => definirFiltro('cidade', e.target.value)}
            >
              <option value="">Todas</option>
              {cidades.map((cidade) => (
                <option key={cidade} value={cidade}>
                  {cidade}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo rotulo="Bairro" id="filtro-bairro">
            <Select
              id="filtro-bairro"
              value={filtros.bairro}
              onChange={(e) => definirFiltro('bairro', e.target.value)}
            >
              <option value="">Todos</option>
              {bairros.map((bairro) => (
                <option key={bairro} value={bairro}>
                  {bairro}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo rotulo="Valor mínimo" id="filtro-valor-min">
            <CampoMoeda
              id="filtro-valor-min"
              valor={filtros.valorMin}
              aoMudar={(v) => definirFiltro('valorMin', v)}
            />
          </Campo>

          <Campo rotulo="Valor máximo" id="filtro-valor-max">
            <CampoMoeda
              id="filtro-valor-max"
              valor={filtros.valorMax}
              aoMudar={(v) => definirFiltro('valorMax', v)}
            />
          </Campo>

          <Campo rotulo="Quartos (mínimo)" id="filtro-quartos">
            <Select
              id="filtro-quartos"
              value={filtros.quartos}
              onChange={(e) => definirFiltro('quartos', e.target.value)}
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+ {n === 1 ? 'quarto' : 'quartos'}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo rotulo="Vagas (mínimo)" id="filtro-vagas">
            <Select
              id="filtro-vagas"
              value={filtros.vagas}
              onChange={(e) => definirFiltro('vagas', e.target.value)}
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+ {n === 1 ? 'vaga' : 'vagas'}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      )}

      {temFiltro && (
        <div className="flex justify-end border-t border-borda pt-3">
          <Button variante="fantasma" tamanho="pequeno" onClick={limparFiltros}>
            <X className="size-4" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}

function Campo({
  rotulo,
  id,
  children,
}: {
  rotulo: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-texto-suave">
        {rotulo}
      </Label>
      {children}
    </div>
  )
}

/** Guarda o número puro na URL e exibe o texto mascarado. */
function CampoMoeda({
  id,
  valor,
  aoMudar,
}: {
  id: string
  valor: string
  aoMudar: (valor: string) => void
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={valor ? numeroParaMoeda(Number(valor)) : ''}
      onChange={(e) => {
        const numero = moedaParaNumero(mascararMoeda(e.target.value))
        aoMudar(numero === null ? '' : String(numero))
      }}
      placeholder="R$ 0,00"
    />
  )
}
