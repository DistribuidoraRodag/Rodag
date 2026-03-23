import { createUntypedAdminClient } from "@/lib/supabase/admin-untyped";
import { RODAG_BRAND_CONTEXT } from "@/lib/agents/prompts";

export interface BusinessContext {
  brandRules: {
    tone: string;
    must_include: string[];
    forbidden_terms: string[];
    style: string;
    color_palette: Record<string, string>;
  };
  restrictedTerms: string[];
  productCatalog: Array<{
    product_name: string;
    category: string;
    valid_brands: string[];
    keywords: string[];
  }>;
  clientPreferences?: {
    preferred_tone: string;
    common_products: string[];
    cta_style: string;
  };
}

const DEFAULT_CONTEXT: BusinessContext = {
  brandRules: {
    tone: "comercial, técnico, direto, confiável",
    must_include: ["telefone", "CTA", "logo Rodag"],
    forbidden_terms: [
      "grátis", "100% garantido", "oferta imperdível", "não perca",
      "última chance", "preço imbatível", "melhor do mercado",
    ],
    style: "industrial limpo, profissional, sem excessos decorativos",
    color_palette: {
      primary: "#1a2e4a", secondary: "#ffffff",
      accent: "#f5a623", text_light: "#ffffff", text_dark: "#1a2e4a",
    },
  },
  restrictedTerms: [
    "grátis", "100% garantido", "oferta imperdível", "não perca",
    "última chance", "preço imbatível", "melhor do mercado",
    "aproveite já", "corra", "oportunidade única",
  ],
  productCatalog: [],
};

export async function loadBusinessContext(clientId?: string): Promise<BusinessContext> {
  try {
    const supabase = createUntypedAdminClient();

    const [brandRes, termsRes, catalogRes] = await Promise.all([
      supabase.from("brand_rules").select("*").eq("is_active", true).limit(1).single(),
      supabase.from("restricted_terms").select("term, severity"),
      supabase.from("product_catalog").select("product_name, category, valid_brands, keywords").eq("is_active", true),
    ]);

    const brand = brandRes.data;
    const terms = termsRes.data;
    const catalog = catalogRes.data;

    if (!brand) return DEFAULT_CONTEXT;

    const context: BusinessContext = {
      brandRules: {
        tone: brand.tone,
        must_include: (brand.must_include as string[]) || [],
        forbidden_terms: (brand.forbidden_terms as string[]) || [],
        style: brand.style,
        color_palette: (brand.color_palette as Record<string, string>) || DEFAULT_CONTEXT.brandRules.color_palette,
      },
      restrictedTerms: terms?.map((t: { term: string }) => t.term) || [],
      productCatalog: (catalog || []).map((p: { product_name: string; category: string; valid_brands: unknown; keywords: unknown }) => ({
        product_name: p.product_name,
        category: p.category,
        valid_brands: (p.valid_brands as string[]) || [],
        keywords: (p.keywords as string[]) || [],
      })),
    };

    if (clientId) {
      const { data: prefs } = await supabase
        .from("client_preferences")
        .select("*")
        .eq("client_id", clientId)
        .single();

      if (prefs) {
        context.clientPreferences = {
          preferred_tone: prefs.preferred_tone || "",
          common_products: (prefs.common_products as string[]) || [],
          cta_style: prefs.cta_style || "",
        };
      }
    }

    return context;
  } catch {
    return DEFAULT_CONTEXT;
  }
}

export function buildPromptContext(context: BusinessContext): string {
  const lines: string[] = [
    "REGRAS DE NEGÓCIO RODAG:",
    `Tom: ${context.brandRules.tone}`,
    `Elementos obrigatórios em toda peça: ${context.brandRules.must_include.join(", ")}`,
    `Estilo visual: ${context.brandRules.style}`,
    `Paleta de cores: primária ${context.brandRules.color_palette.primary}, secundária ${context.brandRules.color_palette.secondary}, destaque ${context.brandRules.color_palette.accent}`,
    "",
    `TERMOS PROIBIDOS (NUNCA usar): ${context.restrictedTerms.join(", ")}`,
    "",
  ];

  if (context.productCatalog.length > 0) {
    lines.push("CATÁLOGO DE PRODUTOS VÁLIDOS:");
    for (const p of context.productCatalog) {
      lines.push(`- ${p.product_name} (${p.category}) — Marcas: ${p.valid_brands.join(", ")}`);
    }
    lines.push("");
  }

  if (context.clientPreferences) {
    lines.push("PREFERÊNCIAS DO CLIENTE:");
    if (context.clientPreferences.preferred_tone)
      lines.push(`Tom preferido: ${context.clientPreferences.preferred_tone}`);
    if (context.clientPreferences.common_products.length > 0)
      lines.push(`Produtos frequentes: ${context.clientPreferences.common_products.join(", ")}`);
    if (context.clientPreferences.cta_style)
      lines.push(`Estilo de CTA: ${context.clientPreferences.cta_style}`);
    lines.push("");
  }

  lines.push(
    "VALIDAÇÃO OBRIGATÓRIA:",
    "- Apenas produtos do catálogo são permitidos",
    "- Nunca usar termos da lista de proibidos",
    "- Incluir todos os elementos obrigatórios na peça",
  );

  // Fallback: append the hardcoded brand context as base
  lines.push("", "CONTEXTO BASE DA MARCA:", RODAG_BRAND_CONTEXT);

  return lines.join("\n");
}
