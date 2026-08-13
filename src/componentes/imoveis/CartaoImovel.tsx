import { Bath, BedDouble, Car, ImageIcon, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/componentes/ui/badge'
import { AcoesImovel } from '@/componentes/imoveis/AcoesImovel'
import { fotoDeCapa, type ImovelComRelacoes } from '@/lib/imoveis'
import { formatarMoedaCurta, ROTULOS_FINALIDADE } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  imovel: ImovelComRelacoes
  aoAlternarStatus: (imovel: ImovelComRelacoes) => void
  aoExcluir: (imovel: ImovelComRelacoes) => void
}

export function CartaoImovel({ imovel, aoAlternarStatus, aoExcluir }: Props) {
  const navegar = useNavigate()
  const capa = fotoDeCapa(imovel)
  const inativo = imovel.status !== 'ativo'

  return (
    <article
      onClick={() => navegar(`/painel/imoveis/${imovel.id}/editar`)}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-xl border border-borda bg-superficie shadow-cartao transition-shadow hover:shadow-elevado',
        inativo && 'opacity-75',
      )}
    >
      {/* ---------- Foto ---------- */}
      <div className="relative aspect-4/3 overflow-hidden bg-superficie-alternativa">
        {capa ? (
          <img
            src={capa}
            alt={imovel.titulo}
            loading="lazy"
            className={cn(
              'size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]',
              inativo && 'grayscale',
            )}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-texto-tenue">
            <ImageIcon className="size-8" strokeWidth={1.5} />
            <span className="text-xs">Sem foto</span>
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variante="escuro">{ROTULOS_FINALIDADE[imovel.finalidade]}</Badge>
            {inativo && <Badge variante="inativo">Inativo</Badge>}
          </div>
          <AcoesImovel
            imovel={imovel}
            aoAlternarStatus={aoAlternarStatus}
            aoExcluir={aoExcluir}
          />
        </div>
      </div>

      {/* ---------- Conteúdo ---------- */}
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-3">
          {/* O código é como a equipe se refere ao imóvel no dia a dia. */}
          <span className="font-mono text-xs font-semibold tracking-wide text-texto-tenue">
            {imovel.codigo}
          </span>
          {imovel.tipos_imovel?.nome && (
            <span className="truncate text-xs text-texto-tenue">
              {imovel.tipos_imovel.nome}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-texto">
          {imovel.titulo}
        </h3>

        <p className="flex items-center gap-1.5 text-sm text-texto-suave">
          <MapPin className="size-3.5 shrink-0 text-texto-tenue" />
          <span className="truncate">
            {imovel.bairro}, {imovel.cidade}
          </span>
        </p>

        <Valores imovel={imovel} />

        {(imovel.quartos > 0 || imovel.banheiros > 0 || imovel.vagas > 0) && (
          <ul className="mt-0.5 flex items-center gap-4 border-t border-borda pt-3 text-sm text-texto-suave">
            <Atributo icone={BedDouble} valor={imovel.quartos} titulo="Quartos" />
            <Atributo icone={Bath} valor={imovel.banheiros} titulo="Banheiros" />
            <Atributo icone={Car} valor={imovel.vagas} titulo="Vagas" />
          </ul>
        )}
      </div>
    </article>
  )
}

/**
 * Valores do imóvel.
 *
 * Com finalidade "ambos", os dois valores aparecem identificados — sem
 * o rótulo, R$ 750.000 e R$ 3.200 lado a lado não dizem qual é qual.
 */
function Valores({ imovel }: { imovel: ImovelComRelacoes }) {
  if (imovel.finalidade === 'ambos') {
    return (
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-texto-tenue">
            Venda
          </span>
          <span className="text-base font-semibold text-texto">
            {formatarMoedaCurta(imovel.valor_venda)}
          </span>
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-texto-tenue">
            Aluguel
          </span>
          <span className="text-base font-semibold text-texto">
            {formatarMoedaCurta(imovel.valor_aluguel)}
          </span>
        </p>
      </div>
    )
  }

  const aluguel = imovel.finalidade === 'locacao'
  return (
    <p className="text-lg font-semibold tracking-tight text-texto">
      {formatarMoedaCurta(aluguel ? imovel.valor_aluguel : imovel.valor_venda)}
      {aluguel && <span className="text-sm font-normal text-texto-tenue"> /mês</span>}
    </p>
  )
}

function Atributo({
  icone: Icone,
  valor,
  titulo,
}: {
  icone: typeof BedDouble
  valor: number
  titulo: string
}) {
  if (valor <= 0) return null
  return (
    <li className="flex items-center gap-1.5" title={titulo}>
      <Icone className="size-4 text-texto-tenue" strokeWidth={1.8} />
      <span className="text-sm">{valor}</span>
    </li>
  )
}
