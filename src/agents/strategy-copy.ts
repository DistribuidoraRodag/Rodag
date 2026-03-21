import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { RODAG_BRAND_CONTEXT } from "./brand-context";
import type { BriefingResult, StrategyCopyResult } from "./types";
import type { Json } from "@/types/database";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

const SYSTEM_PROMPT = `Você é o Strategy + Copy Agent do RODAG MKT SYSTEM.

Sua função: definir a estratégia de comunicação E produzir todos os textos da peça de marketing.

Contexto da marca:
${RODAG_BRAND_CONTEXT}

Regras críticas para copy:
- Linguagem B2B autopeças diesel — NUNCA "copy de curso de marketing digital"
- Sem frases como "transforme sua vida", "sucesso garantido", "oportunidade única"
- Tom: comercial, direto, técnico, confiável
- Headlines objetivas, sem clickbait
- CTA específico para o canal (WhatsApp, telefone, loja)
- Variações reais, não apenas reformulações óbvias
- Copy em português brasileiro

Retorne APENAS JSON válido com esta estrutura:
{
  "strategy": {
    "angle": "ângulo principal",
    "value_prop": "proposta de valor",
    "trigger": "gatilho emocional/racional",
    "approach": "abordagem"
  },
  "copy": {
    "headline_1": "headline principal",
    "headline_2": "headline alternativa",
    "body": "texto principal",
    "caption_short": "legenda curta",
    "caption_long": "legenda longa",
    "cta_primary": "CTA principal",
    "cta_secondary": "CTA alternativo",
    "cta_whatsapp": "mensagem pronta para WhatsApp"
  }
}`;

export async function runStrategyCopyAgent(
  requestId: string,
  briefing: BriefingResult
): Promise<StrategyCopyResult> {
  const supabase = createAdminClient();

  await supabase.from("agent_runs").insert({
    request_id: requestId,
    agent_name: "strategy_copy_agent",
    input_payload: briefing as unknown as Json,
    run_status: "running",
    model_used: "gpt-4o",
  });

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Briefing estruturado:\n${JSON.stringify(briefing, null, 2)}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const result: StrategyCopyResult = JSON.parse(text);

    await supabase.from("deliverables").insert({
      request_id: requestId,
      deliverable_type: "strategy",
      title: "Estratégia + Copy",
      content_json: result as unknown as Json,
      content_text: `${result.copy.headline_1}\n${result.copy.body}`,
    });

    const tokensUsed = (response.usage?.total_tokens ?? 0);
    await supabase
      .from("agent_runs")
      .update({
        output_payload: result as unknown as Json,
        run_status: "completed",
        finished_at: new Date().toISOString(),
        tokens_used: tokensUsed,
        cost_usd: tokensUsed * 0.000007,
      })
      .eq("request_id", requestId)
      .eq("agent_name", "strategy_copy_agent");

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "strategy_copy_completed",
      payload: result as unknown as Json,
    });

    return result;
  } catch (error) {
    await supabase
      .from("agent_runs")
      .update({
        run_status: "failed",
        error_message: String(error),
        finished_at: new Date().toISOString(),
      })
      .eq("request_id", requestId)
      .eq("agent_name", "strategy_copy_agent");
    throw error;
  }
}
