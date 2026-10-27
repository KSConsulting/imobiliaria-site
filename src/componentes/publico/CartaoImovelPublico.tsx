import { Link } from 'react-router-dom'
import { Bath, BedDouble, Car, MapPin, Ruler } from 'lucide-react'
import { FotoProgressiva } from '@/componentes/publico/FotoProgressiva'
import {
  badgesDeFinalidade,
  capaDoImovel,
  LARGURAS_FOTO,
  ROTULOS_FINALIDADE_VITRINE,
  type ImovelVitrine,
} from '@/lib/publico'
import { formatarArea, formatarMoedaCurta } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  imovel: ImovelVitrine
  /** Cards da primeira dobra carregam a foto imediatamente. */
  prioritaria?: boolean
}

/**
 * Cartão do imóvel na vitrine.
 *
 * A foto domina o card por decisão de direção visual: no site público
 * quem escolhe é o cliente final, e ele escolhe pela foto. No painel o
 * mesmo imóvel aparece em lista compacta, porque lá quem lê está
 * gerenciando carteira e precisa comparar dados, não se encantar.
 *
 * O card inteiro é o link. Alvo grande de toque é o que faz diferença no
 * celular, de onde vem a maior parte do tráfego.
 */
export function CartaoImovelPublico({ imovel, prioritaria = false }: Props) {
  const capa = capaDoImovel(imovel)
  const badges = badgesDeFinalidade(imovel.finalidade)

  return (
    <Link
      to={`/imovel/${imovel.codigo}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-borda bg-superficie',
        'shadow-cartao transition-shadow hover:shadow-elevado',
      )}
    >
      {/* ---------------- Foto ---------------- */}
      <div className="relative">
        <FotoProgressiva
          url={capa}
          alt={imovel.titulo}
          proporcao="4/3"
          prioritaria={prioritaria}
          largura={LARGURAS_FOTO.cartao}
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="w-full"
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {badges.map((finalidade) => (
            <span
              key={finalidade}
              className="rounded-full bg-escuro/85 px-2.5 py-1 text-xs font-semibold text-claro backdrop-blur-sm"
            >
              {ROTULOS_FINALIDADE_VITRINE[finalidade]}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          {imovel.tipos_imovel?.nome && (
            <span className="text-xs font-semibold uppercase tracking-wider text-destaque">
              {imovel.tipos_imovel.nome}
            </span>
          )}

          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-texto">
            {imovel.titulo}
          </h3>

          <p className="flex items-center gap-1.5 text-sm text-texto-suave">
            <MapPin className="size-3.5 shrink-0 text-texto-tenue" />
            <span className="truncate">
              {imovel.bairro}, {imovel.cidade}
            </span>
          </p>
        </div>

        {/* Valores. Em `ambos`, os dois aparecem identificados — sem o
            rótulo, R$ 450.000 e R$ 2.500 lado a lado não dizem qual é
            qual. */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {(imovel.finalidade === 'venda' || imovel.finalidade === 'ambos') &&
            imovel.valor_venda !== null && (
              <p className="flex items-baseline gap-1.5">
                {imovel.finalidade === 'ambos' && (
                  <span className="text-xs text-texto-tenue">Venda</span>
                )}
                <span className="text-lg font-bold tracking-tight text-texto">
                  {formatarMoedaCurta(imovel.valor_venda)}
                </span>
              </p>
            )}

          {(imovel.finalidade === 'locacao' || imovel.finalidade === 'ambos') &&
            imovel.valor_aluguel !== null && (
              <p className="flex items-baseline gap-1.5">
                {imovel.finalidade === 'ambos' && (
                  <span className="text-xs text-texto-tenue">Aluguel</span>
                )}
                <span className="text-lg font-bold tracking-tight text-texto">
                  {formatarMoedaCurta(imovel.valor_aluguel)}
                  <span className="text-sm font-medium text-texto-suave">/mês</span>
                </span>
              </p>
            )}
        </div>

        {/* Características */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-borda pt-3.5 text-sm text-texto-suave">
          {imovel.quartos > 0 && <Caracteristica icone={BedDouble} valor={imovel.quartos} rotulo="quartos" />}
          {imovel.banheiros > 0 && <Caracteristica icone={Bath} valor={imovel.banheiros} rotulo="banheiros" />}
          {imovel.vagas > 0 && <Caracteristica icone={Car} valor={imovel.vagas} rotulo="vagas" />}
          {imovel.area_util !== null && (
            <span className="flex items-center gap-1.5" title="Área útil">
              <Ruler className="size-4 text-texto-tenue" />
              {formatarArea(imovel.area_util)}
            </span>
          )}

          <span className="ml-auto text-xs text-texto-tenue">{imovel.codigo}</span>
        </div>
      </div>
    </Link>
  )
}

function Caracteristica({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof BedDouble
  valor: number
  rotulo: string
}) {
  return (
    <span className="flex items-center gap-1.5" title={`${valor} ${rotulo}`}>
      <Icone className="size-4 text-texto-tenue" />
      {valor}
    </span>
  )
}
