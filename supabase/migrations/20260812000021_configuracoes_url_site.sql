-- ============================================================================
-- 021 — Endereço público da vitrine
--
-- A API passa a devolver, em cada ficha de imóvel, a URL da página dele no
-- site. Para montá-la é preciso saber onde a vitrine está publicada, e esse
-- endereço não existia em lugar nenhum que a Edge Function alcançasse:
--
--   • o painel monta o link com `window.location.origin`, que é o navegador;
--   • a Edge Function só conhece o domínio das Functions
--     (<projeto>.supabase.co/functions/v1/api), que não é o da vitrine.
--
-- Fica em `configuracoes`, e não num secret da função, pela mesma razão do
-- `fuso_horario`: é dado de implantação, muda por cliente, e a aba de
-- Configurações existe para que uma instalação nova não exija linha de
-- comando. Um secret obrigaria `supabase secrets set` em cada implantação,
-- justamente por quem só abre o painel.
--
-- **Não confundir com a coluna `site`.** Aquela é o site institucional, se a
-- imobiliária tiver outro além da vitrine, e aparece no rodapé. Esta é o
-- endereço da própria vitrine, e só alimenta a API. Reaproveitar `site`
-- faria o agente mandar o link do Instagram dizendo que é a página do
-- imóvel, no dia em que alguém preenchesse aquele campo com o que ele pede.
--
-- Vazio, o campo `url` de cada ficha sai `null` e a mensagem do agente
-- simplesmente não menciona link. É o estado de hoje, antes do deploy da
-- Etapa 11, e não quebra nada.
-- ============================================================================

alter table public.configuracoes
  add column if not exists url_site text;

comment on column public.configuracoes.url_site is
  'Endereço onde a vitrine está publicada, ex.: https://alvoradaimoveis.com.br. '
  'A API monta a URL de cada imóvel a partir daqui (<url_site>/imovel/IMV-0001) e a '
  'devolve no campo "url" da ficha. Vazio, "url" sai null e o agente não manda link. '
  'Não confundir com "site", que é o site institucional exibido no rodapé.';
