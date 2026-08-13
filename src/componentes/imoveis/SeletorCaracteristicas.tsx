import { useState, type KeyboardEvent } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Input } from '@/componentes/ui/input'
import { cn } from '@/lib/utils'

/**
 * Sugestões comuns.
 *
 * São apenas atalhos: a lista é livre e fica em `imoveis.caracteristicas`
 * (jsonb). Manter isso como texto livre, e não como colunas, é o que
 * permite a cada imobiliária ter o próprio vocabulário de diferenciais
 * sem migração de schema.
 */
const SUGESTOES = [
  'Piscina',
  'Churrasqueira',
  'Elevador',
  'Portaria 24h',
  'Academia',
  'Varanda gourmet',
  'Salão de festas',
  'Playground',
  'Área de serviço',
  'Armários planejados',
  'Ar-condicionado',
  'Aquecimento solar',
]

export function SeletorCaracteristicas({
  valor,
  aoMudar,
}: {
  valor: string[]
  aoMudar: (valor: string[]) => void
}) {
  const [novo, setNovo] = useState('')

  function alternar(item: string) {
    aoMudar(
      valor.some((v) => igual(v, item))
        ? valor.filter((v) => !igual(v, item))
        : [...valor, item],
    )
  }

  function adicionarDigitado() {
    const texto = novo.trim()
    if (!texto) return
    if (!valor.some((v) => igual(v, texto))) aoMudar([...valor, texto])
    setNovo('')
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    // Enter adiciona sem submeter o formulário inteiro — o formulário é
    // longo e um Enter distraído aqui salvaria o imóvel pela metade.
    if (evento.key === 'Enter' || evento.key === ',') {
      evento.preventDefault()
      adicionarDigitado()
    }
  }

  const personalizados = valor.filter((v) => !SUGESTOES.some((s) => igual(s, v)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {SUGESTOES.map((sugestao) => {
          const marcado = valor.some((v) => igual(v, sugestao))
          return (
            <button
              key={sugestao}
              type="button"
              onClick={() => alternar(sugestao)}
              aria-pressed={marcado}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                marcado
                  ? 'border-destaque bg-destaque-suave font-medium text-destaque'
                  : 'border-borda-forte bg-superficie text-texto-suave hover:border-destaque hover:text-texto',
              )}
            >
              {marcado ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {sugestao}
            </button>
          )
        })}
      </div>

      {personalizados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {personalizados.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-destaque bg-destaque-suave px-3 py-1.5 text-sm font-medium text-destaque"
            >
              {item}
              <button
                type="button"
                onClick={() => alternar(item)}
                aria-label={`Remover ${item}`}
                className="cursor-pointer rounded-full transition-opacity hover:opacity-70"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={aoTeclar}
          onBlur={adicionarDigitado}
          placeholder="Adicionar outro diferencial e pressionar Enter"
          className="max-w-md"
        />
      </div>
    </div>
  )
}

function igual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
