import { useEffect, useRef, useState } from 'react'
import { Input } from '@/componentes/ui/input'
import { Select } from '@/componentes/ui/select'
import {
  aceitarDigitados,
  apenasDigitos,
  limiteDeDigitos,
  montarWhatsapp,
  OUTRO_PAIS,
  PAISES,
  paisPorSigla,
  separarWhatsapp,
  validarWhatsapp,
  type Pais,
} from '@/lib/telefone'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  /** Número no formato guardado: DDI mais nacional, só dígitos. */
  valor: string
  aoMudar: (valor: string) => void
  /** Erro vindo de fora, como duplicidade. Tem prioridade sobre o local. */
  erro?: string
  autoFocus?: boolean
  desabilitado?: boolean
}

/**
 * Campo de WhatsApp com seletor de país.
 *
 * Guarda sempre no formato E.164 sem o mais, que é o mesmo que o agente
 * de IA grava. Ver src/lib/telefone.ts para o porquê de existir um
 * formato só.
 *
 * O Brasil vem escolhido porque é o caso de quase toda digitação, e o
 * seletor existe porque comprador estrangeiro não é raro o bastante
 * para obrigar alguém a cadastrar torto.
 *
 * A trava de dígitos é do país escolhido, não um número fixo: 11 no
 * Brasil, 9 em Portugal, 10 nos Estados Unidos. Um limite único serviria
 * mal a todos eles.
 */
export function CampoWhatsapp({
  id = 'whatsapp',
  valor,
  aoMudar,
  erro,
  autoFocus,
  desabilitado,
}: Props) {
  const inicial = separarWhatsapp(valor)
  const [pais, setPais] = useState<Pais>(inicial.pais)
  const [nacional, setNacional] = useState(inicial.nacional)
  const [tocado, setTocado] = useState(false)

  // Guarda o que este campo emitiu, para distinguir a mudança que veio
  // daqui da que veio de fora. Sem isso, cada tecla digitada voltaria
  // pelo prop e o efeito remontaria o estado por cima da digitação.
  const emitido = useRef(valor)

  useEffect(() => {
    if (valor === emitido.current) return
    const separado = separarWhatsapp(valor)
    setPais(separado.pais)
    setNacional(separado.nacional)
    emitido.current = valor
  }, [valor])

  function propagar(novoPais: Pais, novoNacional: string) {
    const montado = montarWhatsapp(novoPais, novoNacional)
    emitido.current = montado
    aoMudar(montado)
  }

  function trocarPais(sigla: string) {
    const novo = paisPorSigla(sigla)
    // O que já estava digitado é reavaliado pela régua do país novo, em
    // vez de ser apagado: trocar o país por engano não deve custar a
    // redigitação do número.
    const ajustado = aceitarDigitados(novo, nacional)
    setPais(novo)
    setNacional(ajustado)
    propagar(novo, ajustado)
  }

  function digitar(texto: string) {
    const aceito = aceitarDigitados(pais, texto)
    setNacional(aceito)
    propagar(pais, aceito)
  }

  const erroLocal = tocado && nacional ? validarWhatsapp(pais, nacional) : null
  const mensagem = erro ?? erroLocal
  const invalido = Boolean(mensagem)
  const completo = !validarWhatsapp(pais, nacional)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Select
          aria-label="País do WhatsApp"
          value={pais.sigla}
          onChange={(e) => trocarPais(e.target.value)}
          disabled={desabilitado}
          className="w-[6.5rem] shrink-0 px-2.5 pr-8"
        >
          {PAISES.map((p) => (
            <option key={p.sigla} value={p.sigla}>
              {p.bandeira} {p.ddi ? `+${p.ddi}` : '···'}
            </option>
          ))}
        </Select>

        <Input
          id={id}
          value={nacional}
          onChange={(e) => digitar(e.target.value)}
          onBlur={() => setTocado(true)}
          placeholder={pais.exemplo}
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={limiteDeDigitos(pais)}
          aria-invalid={invalido}
          disabled={desabilitado}
          autoFocus={autoFocus}
          className="flex-1"
        />
      </div>

      {/* Uma linha só: erro quando há, e senão o que o campo espera. O
          contador some quando o número fica completo, para não competir
          com o resto do formulário depois de resolvido. */}
      {mensagem ? (
        <p className="text-xs text-destrutivo">{mensagem}</p>
      ) : (
        !completo && (
          <p className={cn('text-xs text-texto-tenue')}>
            {pais === OUTRO_PAIS
              ? 'Digite o número completo, com o código do país na frente.'
              : `${pais.nome}: ${pais.comprimentos.join(' ou ')} dígitos com o DDD. ` +
                `Vai salvar como ${pais.ddi}${nacional || '…'}`}
          </p>
        )
      )}
    </div>
  )
}

/** Reexporta para quem só precisa validar antes de salvar. */
export function whatsappValido(guardado: string): boolean {
  const { pais, nacional } = separarWhatsapp(apenasDigitos(guardado))
  return !validarWhatsapp(pais, nacional)
}
