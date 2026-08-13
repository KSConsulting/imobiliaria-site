import { consultaDoMapa } from '@/lib/enderecoNegocio'
import { cn } from '@/lib/utils'

/**
 * O mapa da imobiliária, embutido.
 *
 * Sem chave de API e sem biblioteca: `output=embed` na URL do Maps é
 * servido sem `X-Frame-Options`, ao contrário da URL comum, e é o que
 * torna o iframe possível. A regra do que vai na busca fica em
 * `consultaDoMapa`, para ser a mesma aqui e em qualquer outro lugar que
 * venha a mostrar o endereço.
 *
 * **Não renderiza nada sem rua e cidade.** Um quadro cinza com "não foi
 * possível carregar" no lugar do endereço é pior do que uma seção mais
 * curta: parece site quebrado justamente para quem foi procurar onde a
 * imobiliária fica.
 */
export function MapaEndereco({
  configuracoes,
  nome,
  className,
}: {
  configuracoes: {
    endereco?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
  } | null
  nome: string
  className?: string
}) {
  const consulta = consultaDoMapa(configuracoes)
  if (!consulta) return null

  return (
    <iframe
      title={`Localização de ${nome} no mapa`}
      src={`https://www.google.com/maps?q=${encodeURIComponent(consulta)}&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={cn('w-full rounded-xl border border-borda', className)}
    />
  )
}
