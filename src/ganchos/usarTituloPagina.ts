import { useEffect } from 'react'
import { NOME_NEUTRO, usarConfiguracoes } from '@/contextos/ContextoConfiguracoes'

const DESCRICAO_PUBLICA = 'Imóveis para comprar e alugar'

/**
 * Monta o título da aba a partir do nome da imobiliária.
 *
 * O padrão do Vite ("Vite + React") não pode sobrar em nenhuma das duas
 * áreas. Formatos:
 *
 * - painel  → `Imóveis · Alvorada Imóveis`
 * - público → `Alvorada Imóveis — Imóveis para comprar e alugar`
 * - imóvel  → `Casa no Centro · Alvorada Imóveis`
 *
 * Enquanto as configurações carregam, o nome cai para o texto neutro em
 * vez de exibir vazio ou um travessão solto.
 */
export function usarTituloPagina(titulo?: string, area: 'painel' | 'publico' = 'painel') {
  const { nomeNegocio, carregando } = usarConfiguracoes()

  useEffect(() => {
    const nome = carregando ? NOME_NEUTRO : nomeNegocio

    document.title =
      area === 'publico'
        ? titulo
          ? `${titulo} · ${nome}`
          : `${nome} — ${DESCRICAO_PUBLICA}`
        : titulo
          ? `${titulo} · ${nome}`
          : nome
  }, [titulo, area, nomeNegocio, carregando])
}
