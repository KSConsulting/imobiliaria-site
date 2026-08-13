import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Campo } from '@/componentes/SecaoFormulario'
import { criarTipo, ehNomeDuplicado, renomearTipo, type TipoImovel } from '@/lib/tiposImovel'
import { notificar } from '@/lib/notificacoes'

interface Props {
  aberto: boolean
  aoFechar: () => void
  /** Nulo em cadastro novo. */
  tipo: TipoImovel | null
  /** Nomes já cadastrados, para avisar antes de o banco recusar. */
  nomesExistentes: string[]
  aoSalvar: () => Promise<void>
}

/**
 * Cadastro e renomeação de tipo.
 *
 * Modal, e não página: é um campo só. A regra do projeto é formulário
 * curto em modal, formulário longo em página própria — ver CLAUDE.md.
 */
export function ModalTipoImovel({ aberto, aoFechar, tipo, nomesExistentes, aoSalvar }: Props) {
  const editando = Boolean(tipo)

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setNome(tipo?.nome ?? '')
    setErro(undefined)
  }, [aberto, tipo])

  async function salvar() {
    const limpo = nome.trim()

    if (!limpo) {
      setErro('Informe o nome do tipo.')
      return
    }

    // A checagem local evita a viagem ao banco no caso mais comum, mas
    // não substitui o UNIQUE: entre digitar e salvar, outra aba pode ter
    // criado o mesmo nome. Por isso o catch abaixo trata 23505 também.
    const conflito = nomesExistentes.some(
      (existente) => existente.toLowerCase() === limpo.toLowerCase(),
    )
    if (conflito) {
      setErro('Já existe um tipo com esse nome.')
      return
    }

    setSalvando(true)
    try {
      if (tipo) await renomearTipo(tipo, limpo)
      else await criarTipo(limpo)

      notificar.sucesso(
        editando ? 'Tipo renomeado' : 'Tipo criado',
        editando
          ? 'Os imóveis que já usavam este tipo passam a exibir o novo nome.'
          : 'Ele já aparece no cadastro de imóveis e nos filtros do site.',
      )
      await aoSalvar()
      aoFechar()
    } catch (erroSalvar) {
      if (ehNomeDuplicado(erroSalvar)) {
        setErro('Já existe um tipo com esse nome.')
        return
      }
      notificar.erroDoBanco(erroSalvar, 'Não foi possível salvar o tipo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? 'Renomear tipo' : 'Novo tipo de imóvel'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'O novo nome vale para todos os imóveis que já usam este tipo, no painel e no site.'
              : 'Use o vocabulário da sua região. É esta lista que aparece no cadastro de imóveis e nos filtros do site.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Campo id="nome-tipo" rotulo="Nome" obrigatorio erro={erro}>
            <Input
              id="nome-tipo"
              value={nome}
              autoFocus
              onChange={(e) => {
                setNome(e.target.value)
                setErro(undefined)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void salvar()
              }}
              placeholder="Sobrado"
            />
          </Campo>
        </DialogBody>

        <DialogFooter>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {editando ? 'Salvar' : 'Criar tipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
