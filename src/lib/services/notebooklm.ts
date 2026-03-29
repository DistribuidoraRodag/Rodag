/**
 * NotebookLM Integration — RODAG Knowledge Base
 * Notebook ID: 3cf62a11 — "RODAG — Pecas para Veiculos Pesados"
 * 16 agentes, 87 skills documentados
 *
 * Consulta a base de conhecimento da RODAG para enriquecer
 * contexto dos agentes antes da geracao de conteudo.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const RODAG_NOTEBOOK_ID = "3cf62a11";

// Cached knowledge base context (refreshes every 24h)
let cachedContext: { data: string; timestamp: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load RODAG brand knowledge from database (brand_rules + product_catalog)
 * This serves as the "NotebookLM consulted context" for agents.
 * When the full NotebookLM API is available, this will query the notebook directly.
 */
export async function loadRodagKnowledge(): Promise<string> {
  if (cachedContext && Date.now() - cachedContext.timestamp < CACHE_TTL) {
    return cachedContext.data;
  }

  const supabase = createAdminClient();

  const [brandRes, productsRes, termsRes] = await Promise.all([
    (supabase as any).from("brand_rules").select("*").eq("is_active", true).limit(1).single(),
    (supabase as any).from("product_catalog").select("*").eq("is_active", true),
    (supabase as any).from("restricted_terms").select("term, reason, severity"),
  ]);

  const brand = brandRes.data;
  const products = productsRes.data || [];
  const terms = termsRes.data || [];

  const context = `
=== KNOWLEDGE BASE RODAG (NotebookLM ${RODAG_NOTEBOOK_ID}) ===

IDENTIDADE DA MARCA:
- Nome: RODAG Distribuidora
- Tom: ${brand?.tone || "comercial, tecnico, direto, confiavel"}
- Estilo visual: ${brand?.style || "industrial limpo, profissional"}
- Paleta: ${JSON.stringify(brand?.color_palette || {})}
- Elementos obrigatorios: ${JSON.stringify(brand?.must_include || [])}

CATALOGO DE PRODUTOS (${products.length} itens):
${products.map((p: any) => `- ${p.product_name} (${p.category}) — Marcas: ${(p.valid_brands || []).join(", ")} ${p.technical_notes ? `| ${p.technical_notes}` : ""}`).join("\n")}

TERMOS PROIBIDOS (${terms.length} termos):
${terms.map((t: any) => `- "${t.term}" [${t.severity}]: ${t.reason}`).join("\n")}

DADOS OPERACIONAIS:
- Telefone principal: (31) 3029-0300
- WhatsApp comercial: (31) 99XXX-XXXX
- Localizacao: Belo Horizonte, MG
- Segmento: B2B — autopecas diesel/linha pesada
- Marcas atendidas: Scania, Volvo, Iveco, Mercedes-Benz, MAN, DAF, Volkswagen
- Publico: oficinas mecanicas, transportadoras, frotistas, lojistas
`.trim();

  cachedContext = { data: context, timestamp: Date.now() };
  return context;
}

/**
 * Invalidate cache (use after updating brand_rules or product_catalog)
 */
export function invalidateRodagCache(): void {
  cachedContext = null;
}
