import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Select } from '@/componentes/ui/select'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { queryDaBusca } from '@/ganchos/usarFiltrosVitrine'
import { mascararMoeda, moedaParaNumero } from '@/lib/formato'
import type { TipoVitrine } from '@/lib/publico'
import { cn } from '@/lib/utils'

interface Props {
  tipos: TipoVitrine[]
  cidades: string[]
  bairros: string[]
}

/**
 * Formulário de busca sobreposto à foto da primeira dobra.
 *
 * Quem entra em site de imobiliária tem um objetivo só, e é filtrar.
 * Por isso a busca fica na primeira dobra e não atrás de um botão: o
 * caminho da chegada até a listagem filtrada precisa ser um toque.
 *
 * A finalidade vem primeiro, e como par de botões em vez de select,
 * porque comprar e alugar são navegações diferentes — não são dois
 * valores de um campo qualquer.
 */
export function BuscaHero({ tipos, cidades, bairros }: Props) {
  const navegar = useNavigate()

  const [finalidade, setFinalidade] = useState('venda')
  const [tipo, setTipo] = useState('')
  const [local, setLocal] = useState('')
  const [valorMax, setValorMax] = useState('')
  const [quartos, setQuartos] = useState('')

  function buscar() {
    // O campo de local é um só na interface, mas cidade e bairro são
    // colunas diferentes. Descobrir qual é aqui evita pedir ao visitante
    // que classifique o que digitou — ele quer dizer "Centro", não
    // decidir se Centro é bairro ou cidade.
    const ehCidade = cidades.some((c) => c.toLowerCase() === local.toLowerCase())

    navegar(
      `/imoveis${queryDaBusca({
        finalidade,
        tipo,
        cidade: ehCidade ? local : '',
        bairro: ehCidade ? '' : local,
        valorMax: valorMax ? String(moedaParaNumero(valorMax) ?? '') : '',
        quartos,
      })}`,
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        buscar()
      }}
      className="rounded-2xl border border-borda/60 bg-superficie/95 p-4 shadow-sobreposto backdrop-blur-md sm:p-5"
    >
      {/* Finalidade — primeiro nível de navegação */}
      <div
        className="mb-4 inline-flex rounded-full border border-borda bg-superficie-alternativa p-1"
        role="group"
        aria-label="Finalidade"
      >
        {[
          { valor: 'venda', rotulo: 'Comprar' },
          { valor: 'locacao', rotulo: 'Alugar' },
        ].map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFinalidade(valor)}
            aria-pressed={finalidade === valor}
            className={cn(
              'cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-colors',
              finalidade === valor
                ? 'bg-destaque text-destaque-contraste shadow-cartao'
                : 'text-texto-suave hover:text-texto',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo id="hero-tipo" rotulo="Tipo">
          <Select id="hero-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo id="hero-local" rotulo="Cidade ou bairro">
          <Input
            id="hero-local"
            list="locais-sugeridos"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Onde você procura?"
          />
          <datalist id="locais-sugeridos">
            {[...cidades, ...bairros].map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </Campo>

        <Campo id="hero-valor" rotulo="Valor até">
          <Input
            id="hero-valor"
            inputMode="numeric"
            value={valorMax}
            onChange={(e) => setValorMax(mascararMoeda(e.target.value))}
            placeholder="R$ 0,00"
          />
        </Campo>

        <Campo id="hero-quartos" rotulo="Quartos">
          <Select
            id="hero-quartos"
            value={quartos}
            onChange={(e) => setQuartos(e.target.value)}
          >
            <option value="">Qualquer</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={String(n)}>
                {n}+ {n === 1 ? 'quarto' : 'quartos'}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      <button
        type="submit"
        className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-destaque text-base font-semibold text-destaque-contraste shadow-cartao transition-colors hover:bg-destaque-hover"
      >
        <Search className="size-4.5" />
        Buscar imóveis
      </button>
    </form>
  )
}

function Campo({
  id,
  rotulo,
  children,
}: {
  id: string
  rotulo: string
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
