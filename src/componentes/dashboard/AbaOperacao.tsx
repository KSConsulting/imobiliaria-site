import { useNavigate } from 'react-router-dom'
import { Bot, CalendarClock, Columns3, UserPlus } from 'lucide-react'
import { BlocoDashboard } from '@/componentes/dashboard/BlocoDashboard'
import { GraficoArea, GraficoBarras, GraficoRosca } from '@/componentes/dashboard/Graficos'
import { usarBloco } from '@/ganchos/usarBloco'
import {
  buscarDiaSemana,
  buscarLeadsPorStatus,
  buscarSerieDiaria,
  formatarNumero,
  type Periodo,
  type PontoDiario,
} from '@/lib/dashboard'
import { ETAPAS_FUNIL } from '@/lib/leads'
import { NOMES_DIAS_CURTOS } from '@/lib/datas'

export function AbaOperacao({ periodo }: { periodo: Periodo }) {
  const serie = usarBloco(() => buscarSerieDiaria(periodo), [periodo.inicio, periodo.fim])
  const semana = usarBloco(() => buscarDiaSemana(periodo), [periodo.inicio, periodo.fim])
  const status = usarBloco(() => buscarLeadsPorStatus(), [])
  const navegar = useNavigate()

  const pontos = serie.dados ?? []
  const totalLeads = somar(pontos, 'leads')
  const totalAtendimentos = somar(pontos, 'atendimentos')
  const totalVisitas = somar(pontos, 'visitas')

  const dias = semana.dados ?? []
  const listaStatus = status.dados ?? []
  const totalNoFunil = listaStatus.reduce((soma, l) => soma + l.total, 0)

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* ---------------- Leads por dia ---------------- */}
      <BlocoDashboard
        titulo="Leads novos"
        descricao="Contatos criados no período, por dia."
        icone={UserPlus}
        carregando={serie.carregando}
        erro={serie.erro}
        aoRecarregar={serie.recarregar}
        vazio={totalLeads === 0}
        mensagemVazio="Nenhum lead novo nesse período."
      >
        <>
          <Total valor={totalLeads} rotulo={totalLeads === 1 ? 'lead novo' : 'leads novos'} />
          <GraficoArea pontos={paraGrafico(pontos, 'leads', 'lead')} />
        </>
      </BlocoDashboard>

      {/* ---------------- Atendimentos do agente ---------------- */}
      <BlocoDashboard
        titulo="Atendimentos no WhatsApp"
        // Só conta lead com `inicio_atendimento` preenchido, que é o
        // agente de IA. Lead cadastrado à mão no painel nunca tem esse
        // campo, e é correto que não entre nesta conta.
        descricao="Conversas iniciadas pelo agente de IA, por dia."
        icone={Bot}
        carregando={serie.carregando}
        erro={serie.erro}
        aoRecarregar={serie.recarregar}
        vazio={totalAtendimentos === 0}
        mensagemVazio="Nenhum atendimento pelo agente nesse período. Enquanto a API da Etapa 9 não estiver no ar, este bloco fica zerado."
      >
        <>
          <Total
            valor={totalAtendimentos}
            rotulo={totalAtendimentos === 1 ? 'conversa iniciada' : 'conversas iniciadas'}
          />
          <GraficoArea
            pontos={paraGrafico(pontos, 'atendimentos', 'atendimento')}
            cor="var(--status-conversando)"
          />
        </>
      </BlocoDashboard>

      {/* ---------------- Visitas por dia ---------------- */}
      <BlocoDashboard
        titulo="Visitas"
        // `data_hora_inicio`, não `created_at`: o número que interessa é
        // o movimento do período, não quando a visita foi marcada.
        descricao="Visitas marcadas para acontecer no período, por dia. Canceladas não entram."
        icone={CalendarClock}
        carregando={serie.carregando}
        erro={serie.erro}
        aoRecarregar={serie.recarregar}
        vazio={totalVisitas === 0}
        mensagemVazio="Nenhuma visita nesse período."
      >
        <>
          <Total valor={totalVisitas} rotulo={totalVisitas === 1 ? 'visita' : 'visitas'} />
          <GraficoArea
            pontos={paraGrafico(pontos, 'visitas', 'visita')}
            cor="var(--status-agendou)"
          />
        </>
      </BlocoDashboard>

      {/* ---------------- Dias da semana ---------------- */}
      <BlocoDashboard
        titulo="Concentração por dia da semana"
        descricao="Onde o volume se concentra. Serve para dimensionar a equipe."
        icone={CalendarClock}
        carregando={semana.carregando}
        erro={semana.erro}
        aoRecarregar={semana.recarregar}
        vazio={dias.every((d) => d.atendimentos === 0 && d.visitas === 0)}
        mensagemVazio="Sem atendimentos nem visitas nesse período."
        alturaEsqueleto={300}
      >
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="rotulo-grupo mb-3">Atendimentos no WhatsApp</h4>
            <GraficoBarras
              itens={dias.map((d) => ({
                rotulo: NOMES_DIAS_CURTOS[d.dia_semana],
                valor: d.atendimentos,
                cor: 'var(--status-conversando)',
              }))}
              vazio="Nenhum atendimento nesse período"
            />
          </div>

          <div className="border-t border-borda pt-5">
            <h4 className="rotulo-grupo mb-3">Visitas</h4>
            <GraficoBarras
              itens={dias.map((d) => ({
                rotulo: NOMES_DIAS_CURTOS[d.dia_semana],
                valor: d.visitas,
                cor: 'var(--status-agendou)',
              }))}
              vazio="Nenhuma visita nesse período"
            />
          </div>
        </div>
      </BlocoDashboard>

      {/* ---------------- Funil ---------------- */}
      <BlocoDashboard
        titulo="Leads por etapa do funil"
        // O funil é estado presente, não recorte de período: um lead que
        // entrou em janeiro e continua em "conversando" é justamente o
        // que precisa aparecer aqui.
        descricao="Situação atual de todos os leads — não muda com o período. Clique numa etapa para abrir o Funil filtrado."
        icone={Columns3}
        carregando={status.carregando}
        erro={status.erro}
        aoRecarregar={status.recarregar}
        vazio={totalNoFunil === 0}
        mensagemVazio="Nenhum lead cadastrado ainda."
        alturaEsqueleto={260}
        className="xl:col-span-2"
      >
        <GraficoRosca
          // A ordem é a do percurso do lead, não a da contagem: o funil
          // só é legível na sequência em que as etapas acontecem.
          fatias={ETAPAS_FUNIL.map((etapa) => ({
            rotulo: etapa.rotulo,
            valor: listaStatus.find((l) => l.status === etapa.chave)?.total ?? 0,
            cor: corDaEtapa(etapa.chave),
            aoClicar: () => navegar(`/painel/funil?status=${etapa.chave}`),
          }))}
          total={totalNoFunil}
          rotuloTotal={totalNoFunil === 1 ? 'lead' : 'leads'}
        />
      </BlocoDashboard>
    </div>
  )
}

/* ------------------------------------------------------------- apoio */

function Total({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <p className="mb-3 flex items-baseline gap-2">
      <span className="text-3xl font-bold tracking-tight tabular-nums text-texto">
        {formatarNumero(valor)}
      </span>
      <span className="text-sm text-texto-suave">{rotulo}</span>
    </p>
  )
}

function somar(pontos: PontoDiario[], campo: keyof Omit<PontoDiario, 'dia'>): number {
  return pontos.reduce((soma, ponto) => soma + ponto[campo], 0)
}

/**
 * Converte a série do banco no formato do gráfico.
 *
 * O rótulo é `DD/MM` montado da string `AAAA-MM-DD` que o Postgres
 * devolve, **sem passar por `new Date()`**: `new Date('2026-08-10')` é
 * interpretado como UTC e, num navegador a oeste de Greenwich, volta
 * como 09/08. O dia já veio agrupado no fuso certo pelo banco; convertê-lo
 * de novo aqui só teria como resultado deslocá-lo.
 */
function paraGrafico(
  pontos: PontoDiario[],
  campo: keyof Omit<PontoDiario, 'dia'>,
  substantivo: string,
) {
  return pontos.map((ponto) => {
    const [, mes, dia] = ponto.dia.split('-')
    const valor = ponto[campo]
    return {
      rotulo: `${dia}/${mes}`,
      valor,
      detalhe: `${dia}/${mes}: ${formatarNumero(valor)} ${valor === 1 ? substantivo : `${substantivo}s`}`,
    }
  })
}

/**
 * Cor da etapa, lida das variáveis do sistema de design.
 *
 * As mesmas cores dos badges de status das telas de Leads e Funil — é o
 * que permite reconhecer a etapa aqui e no Kanban sem reaprender a
 * legenda. A chave vira nome de variável CSS (`follow_up_1` →
 * `--status-follow-up-1`), como declarado em `src/index.css`.
 */
function corDaEtapa(chave: string): string {
  return `var(--status-${chave.replace(/_/g, '-')})`
}
