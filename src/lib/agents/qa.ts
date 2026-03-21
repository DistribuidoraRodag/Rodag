// ============================================
// RODAG MKT SYSTEM — QA Agent
// ============================================

import Anthropic from "@anthropic-ai/sdk";
import { QA_PROMPT } from "./prompts";
import type {
  BriefingOutput,
  StrategyCopyOutput,
  CreativeOutput,
  QAOutput,
  AgentResult,
} from "@/types/agents";

const MODEL = "claude-sonnet-4-6-20250514";

function getMockOutput(): QAOutput {
  return {
    score: 8,
    passed: true,
    issues: [],
    feedback:
      "Entrega sólida. Copy alinhada com o tom B2B da Rodag, CTA claro e direcionado. Informações obrigatórias presentes. Pequena sugestão: reforçar o diferencial de preço de distribuidora na headline.",
    recommendation: "approve",
  };
}

export async function runQAAgent(
  briefing: BriefingOutput,
  copy: StrategyCopyOutput,
  creative: CreativeOutput | null
): Promise<AgentResult<QAOutput>> {
  // Mock mode when API key is not available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[QAAgent] ANTHROPIC_API_KEY not set — running in MOCK MODE");
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

    const parts = [
      `Briefing original:\n${JSON.stringify(briefing, null, 2)}`,
      `Strategy + Copy:\n${JSON.stringify(copy, null, 2)}`,
    ];
    if (creative) {
      parts.push(`Direção criativa:\n${JSON.stringify(creative, null, 2)}`);
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: QA_PROMPT,
      messages: [{ role: "user", content: parts.join("\n\n") }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("QA agent returned no valid JSON");
    }

    const output: QAOutput = JSON.parse(jsonMatch[0]);
    // Ensure passed is derived from score
    output.passed = output.score >= 7;

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
