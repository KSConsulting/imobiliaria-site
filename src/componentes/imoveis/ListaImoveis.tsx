import { Bath, BedDouble, Car, ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/componentes/ui/badge'
import { AcoesImovel } from '@/componentes/imoveis/AcoesImovel'
import { fotoDeCapa, type ImovelComRelacoes } from '@/lib/imoveis'
import { formatarMoedaCurta, ROTULOS_FINALIDADE } from '@/lib/formato'
import { cn } from '@/lib/utils'

interface Props {
  imoveis: ImovelComRelacoes[]
  aoAlternarStatus: (imovel: ImovelComRelacoes) => void
  aoExcluir: (imovel: ImovelComRelacoes) => void
}

/**
 * Visualização em lista compacta.
 *
 * A grade é o padrão porque imóvel se reconhece pela foto. Passando de
 * algumas dezenas de imóveis, porém, a lista ganha: cabe muito mais na
 * tela e é mais rápida para localizar por código ou por valor, que é
 * como a equipe procura quando já sabe o que quer.
 */
export function ListaImoveis({ imoveis, aoAlternarStatus, aoExcluir }: Props) {
  const navegar = useNavigate()

  return (
    <div className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-cartao">
      {/* Cabeçalho só no desktop: no mobile cada linha vira um bloco */}
      <div className="hidden grid-cols-[3.5rem_5.5rem_1fr_11rem_9rem_7rem_2.5rem] items-center gap-4 border-b border-borda bg-superficie-alternativa px-4 py-2.5 lg:grid">
        <span className="sr-only">Foto</span>
        <span className="rotulo-grupo">Código</span>
        <span className="rotulo-grupo">Imóvel</span>
        <span className="rotulo-grupo">Localização</span>
        <span className="rotulo-grupo">Valor</span>
        <span className="rotulo-grupo">Situação</span>
        <span className="sr-only">Ações</span>
      </div>

      <ul className="divide-y divide-borda">
        {imoveis.map((imovel) => {
          const capa = fotoDeCapa(imovel)
          const inativo = imovel.status !== 'ativo'

          return (
            <li key={imovel.id}>
              <div
                onClick={() => navegar(`/painel/imoveis/${imovel.id}/editar`)}
                className={cn(
                  'grid cursor-pointer grid-cols-[3.5rem_1fr_2.5rem] items-center gap-4 px-4 py-3 transition-colors hover:bg-superficie-alternativa',
                  'lg:grid-cols-[3.5rem_5.5rem_1fr_11rem_9rem_7rem_2.5rem]',
                  inativo && 'opacity-70',
                )}
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-superficie-alternativa">
                  {capa ? (
                    <img
                      src={capa}
                      alt=""
                      loading="lazy"
                      className={cn('size-full object-cover', inativo && 'grayscale')}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-texto-tenue">
                      <ImageIcon className="size-5" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <span className="hidden font-mono text-xs font-semibold text-texto-suave lg:block">
                  {imovel.codigo}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-texto">{imovel.titulo}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-texto-suave">
                    <span className="font-mono lg:hidden">{imovel.codigo}</span>
                    <span>{ROTULOS_FINALIDADE[imovel.finalidade]}</span>
                    {imovel.tipos_imovel?.nome && <span>{imovel.tipos_imovel.nome}</span>}
                    <span className="lg:hidden">
                      {imovel.bairro}, {imovel.cidade}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {imovel.quartos > 0 && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="size-3.5" /> {imovel.quartos}
                        </span>
                      )}
                      {imovel.banheiros > 0 && (
                        <span className="flex items-center gap-1">
                          <Bath className="size-3.5" /> {imovel.banheiros}
                        </span>
                      )}
                      {imovel.vagas > 0 && (
                        <span className="flex items-center gap-1">
                          <Car className="size-3.5" /> {imovel.vagas}
                        </span>
                      )}
                    </span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-texto lg:hidden">
                    <ValorCompacto imovel={imovel} />
                  </p>
                </div>

                <span className="hidden truncate text-sm text-texto-suave lg:block">
                  {imovel.bairro}, {imovel.cidade}
                </span>

                <span className="hidden text-sm font-semibold text-texto lg:block">
                  <ValorCompacto imovel={imovel} />
                </span>

                <span className="hidden lg:block">
                  {inativo ? (
                    <Badge variante="inativo">Inativo</Badge>
                  ) : (
                    <Badge variante="suave">Ativo</Badge>
                  )}
                </span>

                <AcoesImovel
                  imovel={imovel}
                  aoAlternarStatus={aoAlternarStatus}
                  aoExcluir={aoExcluir}
                  className="border-transparent bg-transparent shadow-none"
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ValorCompacto({ imovel }: { imovel: ImovelComRelacoes }) {
  if (imovel.finalidade === 'ambos') {
    return (
      <span className="flex flex-col leading-tight">
        <span>{formatarMoedaCurta(imovel.valor_venda)}</span>
        <span className="text-xs font-normal text-texto-tenue">
          {formatarMoedaCurta(imovel.valor_aluguel)} /mês
        </span>
      </span>
    )
  }
  const aluguel = imovel.finalidade === 'locacao'
  return (
    <span>
      {formatarMoedaCurta(aluguel ? imovel.valor_aluguel : imovel.valor_venda)}
      {aluguel && <span className="text-xs font-normal text-texto-tenue"> /mês</span>}
    </span>
  )
}
