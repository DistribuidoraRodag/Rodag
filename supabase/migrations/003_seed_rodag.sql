-- ============================================
-- RODAG MKT SYSTEM — Seed Data
-- ============================================

-- Brand Rules
insert into public.brand_rules (brand_name, tone, must_include, forbidden_terms, style, color_palette) values (
  'Rodag',
  'comercial, técnico, direto, confiável',
  '["telefone","CTA","logo Rodag"]',
  '["grátis","100% garantido","oferta imperdível","não perca","última chance","preço imbatível","melhor do mercado","aproveite já","corra","oportunidade única"]',
  'industrial limpo, profissional, sem excessos decorativos',
  '{"primary":"#1a2e4a","secondary":"#ffffff","accent":"#f5a623","text_light":"#ffffff","text_dark":"#1a2e4a"}'
);

-- Product Catalog
insert into public.product_catalog (product_name, category, valid_brands, technical_notes, keywords) values
  ('Filtro de Óleo', 'filtros', '["Scania","Volvo","Mercedes-Benz","MAN","DAF","Iveco"]', 'Linha pesada diesel. Troca a cada 10.000-15.000 km.', '["filtro","óleo","lubrificação","motor"]'),
  ('Filtro de Ar', 'filtros', '["Scania","Volvo","Mercedes-Benz","MAN","Volkswagen"]', 'Elemento filtrante para motores diesel de alta performance.', '["filtro","ar","admissão","respiração"]'),
  ('Filtro de Combustível', 'filtros', '["Scania","Volvo","Mercedes-Benz","DAF","Iveco"]', 'Separador de água e partículas. Essencial para diesel.', '["filtro","combustível","diesel","separador"]'),
  ('Turbina', 'turbinas', '["Scania","Volvo","Mercedes-Benz","MAN"]', 'Turbocompressor para linha pesada. Recondicionado e novo.', '["turbina","turbo","turbocompressor","potência"]'),
  ('Pastilha de Freio', 'freios', '["Scania","Volvo","Mercedes-Benz","MAN","DAF","Iveco","Volkswagen"]', 'Pastilha de freio a disco para eixo dianteiro e traseiro.', '["pastilha","freio","frenagem","disco"]'),
  ('Lona de Freio', 'freios', '["Scania","Volvo","Mercedes-Benz","MAN","Volkswagen"]', 'Lona de freio a tambor. Diversas medidas.', '["lona","freio","tambor","frenagem"]'),
  ('Kit Embreagem', 'embreagens', '["Scania","Volvo","Mercedes-Benz","MAN"]', 'Kit completo: platô, disco e rolamento.', '["embreagem","platô","disco","rolamento","kit"]'),
  ('Amortecedor', 'suspensao', '["Scania","Volvo","Mercedes-Benz","MAN","DAF"]', 'Amortecedor dianteiro e traseiro para cabine e eixo.', '["amortecedor","suspensão","cabine","eixo"]'),
  ('Alternador', 'eletrica', '["Scania","Volvo","Mercedes-Benz","MAN","Iveco"]', 'Alternador 24V para linha pesada. Novo e recondicionado.', '["alternador","elétrica","24V","carga","bateria"]'),
  ('Bomba d''Água', 'motor', '["Scania","Volvo","Mercedes-Benz","MAN","DAF"]', 'Bomba d''água para sistema de arrefecimento diesel.', '["bomba","água","arrefecimento","refrigeração","motor"]');

-- Restricted Terms
insert into public.restricted_terms (term, reason, severity) values
  ('grátis', 'B2B não trabalha com gratuidade. Desvaloriza o produto.', 'blocked'),
  ('100% garantido', 'Promessa absoluta inadequada para autopeças.', 'blocked'),
  ('oferta imperdível', 'Linguagem de varejo. Incompatível com B2B técnico.', 'blocked'),
  ('não perca', 'Gatilho de urgência artificial. Público técnico rejeita.', 'blocked'),
  ('última chance', 'Pressão inadequada para relacionamento B2B de longo prazo.', 'blocked'),
  ('preço imbatível', 'Promessa superlativa sem comprovação.', 'blocked'),
  ('melhor do mercado', 'Comparação genérica sem fundamentação técnica.', 'blocked'),
  ('aproveite já', 'Linguagem de impulso. Mecânico compra por necessidade técnica.', 'blocked'),
  ('corra', 'Tom inadequado para público profissional.', 'blocked'),
  ('oportunidade única', 'Gatilho de escassez artificial.', 'blocked'),
  ('promoção relâmpago', 'Linguagem de e-commerce B2C.', 'blocked'),
  ('compre agora', 'Imperativo agressivo demais para B2B.', 'warning');
