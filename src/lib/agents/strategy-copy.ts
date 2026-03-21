// ============================================
// RODAG MKT SYSTEM — Strategy + Copy Agent
// ============================================

import OpenAI from "openai";
import { STRATEGY_COPY_PROMPT } from "./prompts";
import type { BriefingOutput, StrategyCopyOutput, AgentResult } from "@/types/agents";

const MODEL = "gpt-4o";

function getMockOutput(briefing: BriefingOutput): StrategyCopyOutput {
  return {
    strategy: {
      angle: "Disponibilidade imediata e qualidade garantida",
      value_prop: `${briefing.product} de linha pesada com preço de distribuidora e pronta entrega`,
      trigger: "Evite parada de frota — peça agora e receba rápido",
      approach: "Comercial-informativa com urgência racional",
    },
    copy: {
      headline_1: `${briefing.product} para Linha Pesada — Pronta Entrega`,
      headline_2: `Sua oficina precisa de ${briefing.product}? Temos em estoque.`,
      body: `Peças originais e de reposição para Scania, Volvo, Mercedes, MAN e Iveco. Qualidade garantida, preço de distribuidora e envio imediato para todo o Brasil.`,
      caption_short: `${briefing.product} linha pesada com pronta entrega. Peça seu orçamento!`,
      caption_long: `Precisa de ${briefing.product} para linha pesada? Na Rodag você encontra peças para Scania, Volvo, Mercedes, MAN, DAF e Iveco com preço de distribuidora e disponibilidade imediata.\n\nSomos especialistas em autopeças diesel há mais de 20 anos. Atendimento técnico, catálogo completo e envio rápido.\n\n${briefing.cta}`,
      cta_primary: briefing.cta || "Solicite seu orçamento",
      cta_secondary: "Veja nosso catálogo completo",
      cta_whatsapp: `Olá Rodag! Vi a promoção de ${briefing.product} e gostaria de receber um orçamento. Podem me ajudar?`,
    },
  };
}

export async function runStrategyCopyAgent(
  briefing: BriefingOutput
): Promise<AgentResult<StrategyCopyOutput>> {
  // Mock mode when API key is not available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[StrategyCopyAgent] OPENAI_API_KEY not set — running in MOCK MODE");
    const mockOutput = getMockOutput(briefing);
    return {
      success: true,
      output: mockOutput,
      tokens_used: 0,
      model_used: `${MODEL} (mock)`,
      cost_usd: 0,
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STRATEGY_COPY_PROMPT },
        {
          role: "user",
          content: `Briefing estruturado:\n${JSON.stringify(briefing, null, 2)}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const output: StrategyCopyOutput = JSON.parse(text);
    const tokensUsed = response.usage?.total_tokens ?? 0;

    return {
      success: true,
      output,
      tokens_used: tokensUsed,
      model_used: MODEL,
      cost_usd: tokensUsed * 0.000007,
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
