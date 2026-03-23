// ============================================
// RODAG MKT SYSTEM — Intake Agent
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import { INTAKE_PROMPT } from "./prompts";
import type { IntakeOutput, AgentResult } from "@/types/agents";

const MODEL = "claude-haiku-4-5-20251001";

function getMockOutput(): IntakeOutput {
  return {
    request_type: "instagram_post",
    marketing_goal: "vender",
    product_line: "filtros",
    target_audience: "oficinas_mecanicas",
    known_fields: ["request_type", "marketing_goal", "product_line"],
    missing_fields: ["target_audience"],
    needs_followup_questions: true,
    questions: [
      "Qual o público-alvo principal dessa peça? Oficinas, transportadoras ou lojistas?",
      "Tem algum preço ou condição especial que precisa aparecer na arte?",
      "Qual o telefone/WhatsApp para o CTA?",
    ],
    confidence: 0.65,
  };
}

export async function runIntakeAgent(
  message: string,
  businessContext?: string
): Promise<AgentResult<IntakeOutput>> {
  // Mock mode when API key is not available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[IntakeAgent] ANTHROPIC_API_KEY not set — running in MOCK MODE");
    const mockOutput = getMockOutput();
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
      max_tokens: 1024,
      system: businessContext ? `${INTAKE_PROMPT}\n\n${businessContext}` : INTAKE_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Intake agent returned no valid JSON");
    }

    const output: IntakeOutput = JSON.parse(jsonMatch[0]);
    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;

    return {
      success: true,
      output,
      tokens_used: tokensUsed,
      model_used: MODEL,
      cost_usd: tokensUsed * 0.000001,
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
