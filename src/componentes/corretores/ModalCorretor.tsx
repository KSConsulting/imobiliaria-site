import { useEffect, useState } from 'react'
import { CalendarClock, Loader2, UserRound } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Alternador } from '@/componentes/ui/alternador'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Campo } from '@/componentes/SecaoFormulario'
import { SeletorCor } from '@/componentes/corretores/SeletorCor'
import { EditorJanela, validarJanela } from '@/componentes/corretores/EditorJanela'
import {
  atualizarCorretor,
  buscarIdDaAgenda,
  criarCorretor,
  janelaParaFormulario,
  salvarJanela,
  type CorretorCompleto,
  type LinhaJanela,
} from '@/lib/corretores'
import { iguais, primeiraCorLivre } from '@/lib/coresCorretores'
import { notificar } from '@/lib/notificacoes'

interface Props {
  aberto: boolean
  aoFechar: () => void
  /** Nulo em cadastro novo. */
  corretor: CorretorCompleto | null
  todos: CorretorCompleto[]
  aoSalvar: () => Promise<void>
}

interface Estado {
  nome: string
  sobrenome: string
  whatsapp: string
  email: string
  creci: string
  cor: string
  ativo: boolean
}

export function ModalCorretor({ aberto, aoFechar, corretor, todos, aoSalvar }: Props) {
  const editando = Boolean(corretor)

  const [dados, setDados] = useState<Estado>(vazio())
  const [janela, setJanela] = useState<LinhaJanela[]>(janelaParaFormulario([]))
  const [erros, setErros] = useState<Partial<Record<keyof Estado, string>>>({})
  const [errosJanela, setErrosJanela] = useState<Record<number, string>>({})
  const [salvando, setSalvando] = useState(false)

  const coresUsadas = todos
    .filter((outro) => outro.id !== corretor?.id)
    .map((outro) => ({ hex: outro.cor, porQuem: `${outro.nome} ${outro.sobrenome}` }))

  useEffect(() => {
    if (!aberto) return

    if (corretor) {
      setDados({
        nome: corretor.nome,
        sobrenome: corretor.sobrenome,
        whatsapp: corretor.whatsapp ?? '',
        email: corretor.email ?? '',
        creci: corretor.creci ?? '',
        cor: corretor.cor,
        ativo: corretor.ativo,
      })
      // Os horários vêm do banco — inclusive os que o trigger criou no
      // cadastro (seg a sex, 09:00 às 18:00).
      setJanela(janelaParaFormulario(corretor.agendas?.agendas_horarios ?? []))
    } else {
      setDados({ ...vazio(), cor: primeiraCorLivre(coresUsadas.map((c) => c.hex)) })
      setJanela(janelaPadraoNova())
    }

    setErros({})
    setErrosJanela({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, corretor])

  function definir<C extends keyof Estado>(campo: C, valor: Estado[C]) {
    setDados((atual) => ({ ...atual, [campo]: valor }))
    setErros((atuais) => (atuais[campo] ? { ...atuais, [campo]: undefined } : atuais))
  }

  async function salvar() {
    const novos: Partial<Record<keyof Estado, string>> = {}
    if (!dados.nome.trim()) novos.nome = 'Informe o nome.'
    if (!dados.sobrenome.trim()) novos.sobrenome = 'Informe o sobrenome.'
    if (!dados.cor) novos.cor = 'Escolha uma cor de destaque.'
    if (coresUsadas.some((usada) => iguais(usada.hex, dados.cor))) {
      novos.cor = 'Esta cor já está em uso por outro corretor.'
    }

    const errosDeJanela = validarJanela(janela)
    setErros(novos)
    setErrosJanela(errosDeJanela)

    if (Object.keys(novos).length > 0 || Object.keys(errosDeJanela).length > 0) {
      notificar.erro('Revise o formulário', 'Alguns campos precisam de atenção.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        nome: dados.nome.trim(),
        sobrenome: dados.sobrenome.trim(),
        whatsapp: dados.whatsapp.trim() || null,
        email: dados.email.trim() || null,
        creci: dados.creci.trim() || null,
        cor: dados.cor,
        ativo: dados.ativo,
      }

      if (corretor) {
        await atualizarCorretor(corretor.id, payload, corretor)
        // A agenda já existe: só a janela muda.
        if (corretor.agendas?.id) await salvarJanela(corretor.agendas.id, janela)
        notificar.sucesso('Corretor atualizado', `${payload.nome} ${payload.sobrenome}`)
      } else {
        const novo = await criarCorretor(payload)

        // O trigger já criou a agenda e a janela padrão. Só sobrescreve
        // se o usuário mexeu na janela durante o cadastro.
        if (janelaDiferenteDoPadrao(janela)) {
          const idAgenda = await buscarIdDaAgenda(novo.id)
          if (idAgenda) await salvarJanela(idAgenda, janela)
        }

        notificar.sucesso(
          'Corretor cadastrado',
          `${payload.nome} já tem agenda criada, com o horário definido aqui.`,
        )
      }

      await aoSalvar()
      aoFechar()
    } catch (erro) {
      notificar.erroDoBanco(erro, 'Não foi possível salvar o corretor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar corretor' : 'Novo corretor'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Dados de cadastro e janela de atendimento.'
              : 'A agenda deste corretor é criada automaticamente ao salvar.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-7">
          {/* ---------------- Dados ---------------- */}
          <section className="flex flex-col gap-5">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-texto">
              <UserRound className="size-4 text-destaque" />
              Dados do corretor
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="nome" rotulo="Nome" obrigatorio erro={erros.nome}>
                <Input
                  id="nome"
                  value={dados.nome}
                  onChange={(e) => definir('nome', e.target.value)}
                  aria-invalid={Boolean(erros.nome)}
                  placeholder="Ana"
                  autoFocus
                />
              </Campo>

              <Campo id="sobrenome" rotulo="Sobrenome" obrigatorio erro={erros.sobrenome}>
                <Input
                  id="sobrenome"
                  value={dados.sobrenome}
                  onChange={(e) => definir('sobrenome', e.target.value)}
                  aria-invalid={Boolean(erros.sobrenome)}
                  placeholder="Ribeiro"
                />
              </Campo>

              <Campo id="whatsapp" rotulo="WhatsApp">
                <Input
                  id="whatsapp"
                  value={dados.whatsapp}
                  onChange={(e) => definir('whatsapp', e.target.value)}
                  placeholder="(11) 90000-0000"
                  inputMode="tel"
                />
              </Campo>

              <Campo id="email" rotulo="Email">
                <Input
                  id="email"
                  type="email"
                  value={dados.email}
                  onChange={(e) => definir('email', e.target.value)}
                  placeholder="ana@imobiliaria.com.br"
                />
              </Campo>

              <Campo id="creci" rotulo="CRECI">
                <Input
                  id="creci"
                  value={dados.creci}
                  onChange={(e) => definir('creci', e.target.value)}
                  placeholder="123456-F"
                />
              </Campo>

              <div className="flex items-end pb-1">
                <div className="flex items-center gap-3">
                  <Alternador
                    id="ativo"
                    marcado={dados.ativo}
                    aoMudar={(v) => definir('ativo', v)}
                  />
                  <Label htmlFor="ativo" className="cursor-pointer">
                    {dados.ativo ? 'Ativo' : 'Inativo'}
                  </Label>
                </div>
              </div>
            </div>

            <Campo id="cor" rotulo="Cor de destaque" obrigatorio erro={erros.cor}>
              <SeletorCor
                valor={dados.cor}
                aoMudar={(hex) => definir('cor', hex)}
                usadas={coresUsadas}
              />
            </Campo>
          </section>

          {/* ---------------- Janela ---------------- */}
          <section className="flex flex-col gap-4 border-t border-borda pt-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-texto">
              <CalendarClock className="size-4 text-destaque" />
              Janela de atendimento
            </h4>
            <EditorJanela linhas={janela} aoMudar={setJanela} erros={errosJanela} />
          </section>
        </DialogBody>

        <DialogFooter>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar corretor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function vazio(): Estado {
  return { nome: '', sobrenome: '', whatsapp: '', email: '', creci: '', cor: '', ativo: true }
}

/** Espelha o que o trigger cria: seg a sex, 09:00 às 18:00. */
function janelaPadraoNova(): LinhaJanela[] {
  return Array.from({ length: 7 }, (_, diaSemana) => ({
    diaSemana,
    ativo: diaSemana >= 1 && diaSemana <= 5,
    horaInicio: '09:00',
    horaFim: '18:00',
  }))
}

function janelaDiferenteDoPadrao(linhas: LinhaJanela[]): boolean {
  return JSON.stringify(linhas) !== JSON.stringify(janelaPadraoNova())
}
