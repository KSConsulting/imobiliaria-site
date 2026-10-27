import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Copy } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Select } from '@/componentes/ui/select'
import { CODIGOS_ERRO, ENDPOINTS, GRUPOS, type Endpoint } from '@/lib/endpointsApi'
import { copiar, type TokenApi } from '@/lib/tokens'
import { notificar } from '@/lib/notificacoes'
import { cn } from '@/lib/utils'

/**
 * URL base da API.
 *
 * Derivada de `VITE_SUPABASE_URL` e não escrita à mão: o endereço muda a
 * cada projeto Supabase, e uma URL fixa aqui faria os exemplos desta
 * página apontarem para a instalação de outro cliente.
 */
export const BASE_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`

const PLACEHOLDER = 'SEU_TOKEN_AQUI'

/**
 * Documentação dos endpoints, dentro da aba API.
 *
 * O objetivo é declarado: **montar o agente no N8N sem abrir o código**.
 * Por isso os exemplos vêm com a URL base já correta e com o token
 * escolhido na lista preenchido — copiar e colar, sem edição manual, que
 * é onde nascem os erros de digitação em credencial.
 */
export function DocumentacaoApi({ tokens }: { tokens: TokenApi[] }) {
  const ativos = useMemo(() => tokens.filter((t) => t.ativo), [tokens])
  const [idToken, setIdToken] = useState('')

  const token = ativos.find((t) => t.id === idToken)?.token ?? PLACEHOLDER
  const usandoPlaceholder = token === PLACEHOLDER

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h3 className="titulo-secao">Documentação dos endpoints</h3>
        <p className="texto-apoio max-w-3xl">
          Tudo o que é preciso para montar o agente no N8N. Escolha um token abaixo e os exemplos
          já saem prontos para colar, com a URL desta instalação e a credencial preenchida.
        </p>
      </div>

      {/* ------------------------------------------------- base e token -- */}
      <div className="cartao flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="rotulo-grupo">URL base</span>
          <LinhaCopiavel valor={BASE_API} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="rotulo-grupo">Autenticação</span>
          <p className="text-xs text-texto-suave">
            Todo endpoint exige o cabeçalho abaixo. Sem ele, com token inexistente ou com token
            revogado, a resposta é <code className="font-mono">401</code>.
          </p>
          <LinhaCopiavel valor={`Authorization: Bearer ${token}`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="rotulo-grupo">Token usado nos exemplos</span>
          {ativos.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-alerta/30 bg-alerta/6 px-3.5 py-2.5 text-xs leading-relaxed text-texto-suave">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alerta" />
              Nenhum token ativo. Crie um acima e ele aparece aqui. Os exemplos ficam com{' '}
              <code className="font-mono">{PLACEHOLDER}</code> até lá.
            </p>
          ) : (
            <Select
              value={idToken}
              onChange={(e) => setIdToken(e.target.value)}
              aria-label="Token usado nos exemplos"
            >
              <option value="">Não preencher o token nos exemplos</option>
              {ativos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          )}
          {!usandoPlaceholder && (
            <p className="text-xs text-texto-tenue">
              Os exemplos abaixo estão com o valor real deste token. Trate o que copiar daqui como
              senha.
            </p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- endpoints --- */}
      {GRUPOS.map((grupo) => (
        <div key={grupo.chave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h4 className="titulo-secao">{grupo.rotulo}</h4>
            <p className="texto-apoio">{grupo.resumo}</p>
          </div>

          {ENDPOINTS.filter((e) => e.grupo === grupo.chave).map((endpoint) => (
            <CartaoEndpoint key={endpoint.caminho} endpoint={endpoint} token={token} />
          ))}
        </div>
      ))}

      {/* ------------------------------------------------ códigos de erro */}
      <div className="cartao flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h4 className="titulo-secao">Códigos de erro</h4>
          <p className="texto-apoio max-w-2xl">
            O campo <code className="font-mono">erro</code> é estável e serve ao switch do N8N. O
            campo <code className="font-mono">mensagem</code> é o texto em português para o cliente.
            Não compare texto no fluxo, compare o código.
          </p>
          <p className="texto-apoio max-w-2xl">
            O status HTTP responde outra pergunta: se a requisição funcionou, não se ela deu o
            resultado esperado. Horário ocupado é resposta, não falha, então vem em{' '}
            <code className="font-mono">200</code> com{' '}
            <code className="font-mono">sucesso: false</code>, e assim o nó HTTP do N8N entrega a{' '}
            <code className="font-mono">mensagem</code> pronta em vez de embrulhá-la num{' '}
            <code className="font-mono">error.message</code>. Só os códigos marcados abaixo com
            status diferente de 200 fazem o nó falhar.
          </p>
        </div>

        <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
          {CODIGOS_ERRO.map((item) => (
            <li key={item.codigo} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
              <code className="font-mono text-xs font-semibold text-destaque">{item.codigo}</code>
              {/* Distingue por peso e não por cor: a lista inteira é de
                  códigos de erro, e um vermelho aqui competiria com o
                  destaque do próprio código sem separar nada. */}
              <code
                className={cn(
                  'font-mono text-[0.6875rem] tabular-nums',
                  item.http === 200 ? 'text-texto-suave/70' : 'font-semibold text-texto',
                )}
              >
                {item.http}
              </code>
              <span className="text-xs text-texto-suave">{item.quando}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CartaoEndpoint({ endpoint, token }: { endpoint: Endpoint; token: string }) {
  const [aberto, setAberto] = useState(false)

  const curl = montarCurl(endpoint, token)

  return (
    <div className="cartao overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[0.6875rem] font-bold',
            endpoint.metodo === 'GET'
              ? 'bg-status-conversando/12 text-status-conversando'
              : 'bg-status-visitou/12 text-status-visitou',
          )}
        >
          {endpoint.metodo}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <code className="font-mono text-sm font-semibold break-all text-texto">
            {endpoint.caminho}
          </code>
          <span className="text-xs text-texto-suave">{endpoint.titulo}</span>
        </span>

        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-texto-tenue transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {aberto && (
        <div className="flex flex-col gap-4 border-t border-borda px-4 py-4 sm:px-5">
          <p className="text-sm leading-relaxed text-texto-suave">{endpoint.proposito}</p>

          {endpoint.parametros.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="rotulo-grupo">Parâmetros</span>
              <ul className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
                {endpoint.parametros.map((parametro) => (
                  <li key={parametro.nome} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2">
                    <code className="font-mono text-xs font-semibold text-texto">
                      {parametro.nome}
                    </code>
                    <span className="text-[0.6875rem] text-texto-tenue">{parametro.tipo}</span>
                    {parametro.obrigatorio && (
                      <span className="rounded-full bg-destrutivo/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-destrutivo">
                        obrigatório
                      </span>
                    )}
                    {parametro.descricao && (
                      <span className="w-full text-xs text-texto-suave">{parametro.descricao}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Com mais de uma forma de chamada, cada uma ganha o seu
              bloco, com rótulo e um botão de copiar próprio. Juntá-las
              num bloco só devolveria ao leitor o trabalho de separar
              dois comandos antes de colar qualquer um deles. */}
          {endpoint.exemplos?.length ? (
            <div className="flex flex-col gap-5">
              {endpoint.exemplos.map((exemplo) => (
                <div key={exemplo.rotulo} className="flex flex-col gap-2">
                  <span className="rotulo-grupo">Exemplo de chamada · {exemplo.rotulo}</span>
                  {exemplo.nota && (
                    <p className="text-xs leading-relaxed text-texto-suave">{exemplo.nota}</p>
                  )}
                  <BlocoCodigo
                    texto={montarCurl(endpoint, token, exemplo.corpo)}
                    rotuloCopia={`Copiar chamada: ${exemplo.rotulo}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="rotulo-grupo">Exemplo de chamada</span>
              <BlocoCodigo texto={curl} rotuloCopia="Copiar chamada" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="rotulo-grupo">Resposta</span>
            <BlocoCodigo texto={endpoint.resposta} rotuloCopia="Copiar resposta" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Monta o `curl` do exemplo.
 *
 * `curl` e não um nó de HTTP Request pronto: o N8N muda o formato do
 * fluxo entre versões, e um JSON de nó exportado hoje quebra na próxima.
 * `curl` o N8N importa direto, no botão "Import cURL" do nó HTTP Request,
 * e continua legível para quem usa outra ferramenta.
 */
function montarCurl(
  endpoint: Endpoint,
  token: string,
  corpo: Record<string, unknown> | undefined = endpoint.corpoExemplo,
): string {
  const linhas = [`curl -X ${endpoint.metodo} '${BASE_API}${endpoint.caminhoExemplo}' \\`]
  linhas.push(`  -H 'Authorization: Bearer ${token}' \\`)

  if (corpo) {
    linhas.push(`  -H 'Content-Type: application/json' \\`)
    linhas.push(`  -d '${JSON.stringify(corpo, null, 2)}'`)
  } else {
    // Sem corpo, a última linha não pode terminar com a barra de
    // continuação — colada assim, ela engole a linha seguinte do
    // terminal e o comando falha sem explicação.
    linhas[linhas.length - 1] = linhas[linhas.length - 1].replace(/ \\$/, '')
  }

  return linhas.join('\n')
}

function BlocoCodigo({ texto, rotuloCopia }: { texto: string; rotuloCopia: string }) {
  const [copiado, setCopiado] = useState(false)

  async function aoCopiar() {
    const ok = await copiar(texto)
    if (!ok) {
      notificar.aviso('Não consegui copiar', 'Selecione o texto e copie manualmente.')
      return
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-borda bg-superficie-alternativa px-4 py-3 pr-24 font-mono text-xs leading-relaxed text-texto">
        {texto}
      </pre>
      <Button
        type="button"
        variante="secundario"
        tamanho="pequeno"
        onClick={() => void aoCopiar()}
        className="absolute top-2 right-2"
        aria-label={rotuloCopia}
      >
        {copiado ? <Check className="size-3.5 text-sucesso" /> : <Copy className="size-3.5" />}
        {copiado ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  )
}

function LinhaCopiavel({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false)

  async function aoCopiar() {
    const ok = await copiar(valor)
    if (!ok) {
      notificar.aviso('Não consegui copiar', 'Selecione o texto e copie manualmente.')
      return
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-borda bg-superficie-alternativa px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-texto">
        {valor}
      </code>
      <Button
        type="button"
        variante="fantasma"
        tamanho="iconePequeno"
        onClick={() => void aoCopiar()}
        aria-label="Copiar"
      >
        {copiado ? <Check className="size-4 text-sucesso" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
