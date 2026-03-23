// ============================================
// RODAG MKT SYSTEM — Creative Agent
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import { CREATIVE_PROMPT } from "./prompts";
import type {
  BriefingOutput,
  StrategyCopyOutput,
  CreativeOutput,
  AgentResult,
} from "@/types/agents";

const MODEL = "claude-sonnet-4-6-20250514";

function getMockOutput(
  briefing: BriefingOutput,
  copy: StrategyCopyOutput
): CreativeOutput {
  return {
    visual_direction: {
      style:
        "Industrial limpo, fotografia de produto em fundo escuro com iluminação direcional, tipografia bold sans-serif",
      colors: ["#1a2e4a", "#ffffff", "#f5a623", "#2d4a6f"],
      hierarchy: [
        copy.copy.headline_1,
        "Imagem do produto",
        "Preço/oferta",
        copy.copy.cta_primary,
        "Logo Rodag",
      ],
      mood: "Profissional, confiável, industrial premium",
    },
    layout: {
      format: briefing.format || "1080x1080",
      top: `Headline principal: "${copy.copy.headline_1}" em branco sobre faixa azul escuro`,
      center: `Foto do produto (${briefing.product}) com iluminação profissional sobre fundo gradiente azul`,
      bottom_left: `CTA: "${copy.copy.cta_primary}" em botão amarelo (#f5a623)`,
      bottom_right: "Telefone/WhatsApp da Rodag",
      corner: "Logo Rodag no canto superior direito",
    },
    image_prompt: `Professional product photography of heavy-duty diesel ${briefing.product} auto parts on a dark navy blue (#1a2e4a) gradient background, studio lighting with dramatic side light, industrial clean aesthetic, no text overlay, high resolution, commercial product shot style, metallic parts with visible quality details`,
    designer_instruction: `Peça ${briefing.format || "1080x1080"} para ${briefing.piece_type}.\n\n1. Fundo: gradiente azul escuro (#1a2e4a) para azul médio (#2d4a6f)\n2. Topo: faixa com headline "${copy.copy.headline_1}" em branco, fonte bold sans-serif (Montserrat ou similar), tamanho grande\n3. Centro: foto do produto centralizada, com sombra sutil\n4. Inferior esquerdo: botão amarelo (#f5a623) com CTA "${copy.copy.cta_primary}" em preto bold\n5. Inferior direito: telefone/WhatsApp em branco, tamanho médio\n6. Canto superior direito: logo Rodag em branco, tamanho contido\n7. Manter espaçamento generoso, visual limpo e profissional\n8. Não usar mais de 3 fontes. Hierarquia clara por tamanho.`,
  };
}

export async function runCreativeAgent(
  briefing: BriefingOutput,
  copy: StrategyCopyOutput,
  businessContext?: string
): Promise<AgentResult<CreativeOutput>> {
  // Mock mode when API key is not available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[CreativeAgent] ANTHROPIC_API_KEY not set — running in MOCK MODE");
    const mockOutput = getMockOutput(briefing, copy);
    return {
      success: true,
      output: mockOutput,
      tokens_used: 0,
      model_used: `${MODEL} (mock)`,
      cost_usd: 0,
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: businessContext ? `${CREATIVE_PROMPT}\n\n${businessContext}` : CREATIVE_PROMPT,
      messages: [
        {
          role: "user",
          content: `Briefing:\n${JSON.stringify(briefing, null, 2)}\n\nCopy produzida:\n${JSON.stringify(copy, null, 2)}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Creative agent returned no valid JSON");
    }

    const output: CreativeOutput = JSON.parse(jsonMatch[0]);
    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;

    return {
      success: true,
      output,
      tokens_used: tokensUsed,
      model_used: MODEL,
      cost_usd: tokensUsed * 0.000005,
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: String(error),
      model_used: MODEL,
    };
  }
}
