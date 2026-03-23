// ============================================
// RODAG MKT SYSTEM — Briefing Agent
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import { BRIEFING_PROMPT } from "./prompts";
import type { IntakeOutput, BriefingOutput, AgentResult } from "@/types/agents";

const MODEL = "claude-sonnet-4-6-20250514";

function getMockOutput(intakeOutput: IntakeOutput): BriefingOutput {
  return {
    summary: `Post para Instagram promovendo ${intakeOutput.product_line ?? "filtros"} para ${intakeOutput.target_audience ?? "oficinas mecânicas"}`,
    piece_type: intakeOutput.request_type ?? "instagram_post",
    format: "1080x1080",
    goal: intakeOutput.marketing_goal ?? "vender",
    audience: intakeOutput.target_audience ?? "oficinas_mecanicas",
    audience_profile:
      "Mecânicos e donos de oficina, 30-55 anos, que buscam peças confiáveis com disponibilidade imediata e preço competitivo de distribuidora.",
    product: intakeOutput.product_line ?? "filtros",
    offer: "",
    mandatory_elements: [
      "Logo Rodag",
      "Telefone/WhatsApp",
      "Imagem do produto",
    ],
    tone: "Comercial, técnico, direto e confiável",
    cta: "Solicite seu orçamento pelo WhatsApp",
    restrictions: [
      "Não usar linguagem informal ou gírias",
      "Não usar jargões de marketing digital",
      "Não prometer prazos sem confirmação",
    ],
    brand_context:
      "Rodag é distribuidora de autopeças diesel para linha pesada. Foco em disponibilidade, preço justo e atendimento técnico.",
  };
}

export async function runBriefingAgent(
  messages: { role: string; content: string }[],
  intakeOutput: IntakeOutput,
  businessContext?: string
): Promise<AgentResult<BriefingOutput>> {
  // Mock mode when API key is not available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[BriefingAgent] ANTHROPIC_API_KEY not set — running in MOCK MODE");
    const mockOutput = getMockOutput(intakeOutput);
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

    // Build conversation context from messages
    const conversationText = messages
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n\n");

    const intakeContext = `Dados extraídos pelo intake agent:\n${JSON.stringify(intakeOutput, null, 2)}`;

    const userContent = `${conversationText}\n\n${intakeContext}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: businessContext ? `${BRIEFING_PROMPT}\n\n${businessContext}` : BRIEFING_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Briefing agent returned no valid JSON");
    }

    const output: BriefingOutput = JSON.parse(jsonMatch[0]);
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
