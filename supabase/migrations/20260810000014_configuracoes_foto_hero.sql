-- =====================================================================
-- ImobFlow — Etapa 6 — Foto de fundo da primeira dobra do site
-- =====================================================================
-- A vitrine abre com uma foto grande ocupando a dobra. Ela não pode
-- estar fixa no código: cada imobiliária tem a sua, e um caminho
-- hardcoded transformaria "trocar a foto do site" em um deploy.
--
-- A escolha é opcional de propósito. Quando esta coluna está vazia, o
-- site cai para a foto de capa do imóvel em destaque, que já existe e
-- costuma ser a melhor foto da carteira. Só quando não há nem imóvel com
-- foto é que entra o fundo sólido na cor de destaque — nunca um espaço
-- quebrado.
--
-- Guarda a URL pública, no mesmo formato de `imoveis_fotos.url`, e não o
-- caminho interno do bucket: é assim que o site consegue exibir a
-- imagem sem nenhuma tradução no meio.
-- =====================================================================

alter table public.configuracoes
  add column if not exists foto_hero_url text;

comment on column public.configuracoes.foto_hero_url is
  'URL pública da foto de fundo da primeira dobra do site. Vazia = usa a capa do imóvel em destaque. Ver NICHO.md.';
