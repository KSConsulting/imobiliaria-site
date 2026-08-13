import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Select } from '@/componentes/ui/select'
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '@/lib/formato'
import type { FiltrosVitrine as Filtros, TipoVitrine } from '@/lib/publico'
import { cn } from '@/lib/utils'

interface Props {
  filtros: Filtros
  definirFiltro: (chave: keyof Filtros, valor: string) => void
  limparFiltros: () => void
  tipos: TipoVitrine[]
  cidades: string[]
  bairros: string[]
  temFiltro: boolean
}

/**
 * Barra de filtros da listagem.
 *
 * **A finalidade não é mais um filtro.** Ela fica separada e maior,
 * acima dos demais, porque comprar e alugar são dois sites diferentes
 * na cabeça de quem procura — e porque é a escolha da finalidade que dá
 * sentido ao valor exibido e à ordenação por preço. Um select "venda /
 * locação" no meio de outros seis a esconderia.
 *
 * No celular os filtros secundários começam recolhidos: eles ocupariam a
 * tela inteira antes do primeiro imóvel, e quem chegou por link de
 * WhatsApp quer ver imóvel, não formulário. Já aplicados, aparecem
 * abertos — filtro invisível é filtro que o visitante não sabe que está
 * limitando o que ele vê.
 */
export function FiltrosVitrine({
  filtros,
  definirFiltro,
  limparFiltros,
  tipos,
  cidades,
  bairros,
  temFiltro,
}: Props) {
  const secundariosAplicados = Boolean(
    filtros.tipo ||
      filtros.cidade ||
      filtros.bairro ||
      filtros.valorMin ||
      filtros.valorMax ||
      filtros.quartos ||
      filtros.banheiros ||
      filtros.vagas,
  )

  const [abertos, setAbertos] = useState(secundariosAplicados)

  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4 shadow-cartao sm:p-5">
      {/* ---------------- Finalidade ---------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-full border border-borda bg-superficie-alternativa p-1"
          role="group"
          aria-label="Finalidade"
        >
          {[
            { valor: '', rotulo: 'Todos' },
            { valor: 'venda', rotulo: 'Comprar' },
            { valor: 'locacao', rotulo: 'Alugar' },
          ].map(({ valor, rotulo }) => (
            <button
              key={valor || 'todos'}
              type="button"
              onClick={() => definirFiltro('finalidade', valor)}
              aria-pressed={filtros.finalidade === valor}
              className={cn(
                'cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5',
                filtros.finalidade === valor
                  ? 'bg-destaque text-destaque-contraste shadow-cartao'
                  : 'text-texto-suave hover:text-texto',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAbertos((v) => !v)}
          aria-expanded={abertos}
          className={cn(
            'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
            abertos || secundariosAplicados
              ? 'border-destaque text-destaque'
              : 'border-borda-forte text-texto-suave hover:text-texto',
          )}
        >
          <SlidersHorizontal className="size-4" />
          Filtros
        </button>

        <Select
          value={filtros.ordem}
          onChange={(e) => definirFiltro('ordem', e.target.value)}
          aria-label="Ordenação"
          className="ml-auto h-11 w-full sm:w-52"
        >
          <option value="">Mais recentes</option>
          <option value="menor-valor">Menor valor</option>
          <option value="maior-valor">Maior valor</option>
        </Select>
      </div>

      {/* ---------------- Filtros secundários ---------------- */}
      {abertos && (
        <div className="mt-5 grid gap-4 border-t border-borda pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Campo id="filtro-tipo" rotulo="Tipo de imóvel">
            <Select
              id="filtro-tipo"
              value={filtros.tipo}
              onChange={(e) => definirFiltro('tipo', e.target.value)}
            >
              <option value="">Todos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo id="filtro-cidade" rotulo="Cidade">
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

          <Campo id="filtro-bairro" rotulo="Bairro">
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

          <Campo id="filtro-quartos" rotulo="Quartos (mínimo)">
            <Select
              id="filtro-quartos"
              value={filtros.quartos}
              onChange={(e) => definirFiltro('quartos', e.target.value)}
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+
                </option>
              ))}
            </Select>
          </Campo>

          <Campo id="filtro-valor-min" rotulo="Valor mínimo">
            <CampoMoeda
              id="filtro-valor-min"
              valor={filtros.valorMin}
              aoMudar={(v) => definirFiltro('valorMin', v)}
            />
          </Campo>

          <Campo id="filtro-valor-max" rotulo="Valor máximo">
            <CampoMoeda
              id="filtro-valor-max"
              valor={filtros.valorMax}
              aoMudar={(v) => definirFiltro('valorMax', v)}
            />
          </Campo>

          <Campo id="filtro-banheiros" rotulo="Banheiros (mínimo)">
            <Select
              id="filtro-banheiros"
              value={filtros.banheiros}
              onChange={(e) => definirFiltro('banheiros', e.target.value)}
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+
                </option>
              ))}
            </Select>
          </Campo>

          <Campo id="filtro-vagas" rotulo="Vagas (mínimo)">
            <Select
              id="filtro-vagas"
              value={filtros.vagas}
              onChange={(e) => definirFiltro('vagas', e.target.value)}
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>
                  {n}+
                </option>
              ))}
            </Select>
          </Campo>
        </div>
      )}

      {temFiltro && (
        <div className="mt-4 flex justify-end border-t border-borda pt-4">
          <button
            type="button"
            onClick={limparFiltros}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-texto-suave transition-colors hover:text-destaque"
          >
            <X className="size-4" />
            Limpar filtros
          </button>
        </div>
      )}
    </div>
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
