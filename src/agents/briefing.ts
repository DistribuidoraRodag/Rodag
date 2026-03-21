import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { RODAG_BRAND_CONTEXT } from "./brand-context";
import type { BriefingResult } from "./types";
import type { Json } from "@/types/database";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const SYSTEM_PROMPT = `Você é o Briefing Agent do RODAG MKT SYSTEM.

Sua função: consolidar toda a conversa em um briefing estruturado, limpo e técnico para ser usado pelos agentes de produção.

Contexto da marca:
${RODAG_BRAND_CONTEXT}

Regras:
- Briefing deve ser específico, sem linguagem vaga
- Sem contradições
- Tom sempre alinhado com B2B autopeças diesel
- Enriqueça com contexto da marca Rodag quando relevante
- Se o cliente não especificou algo, use o padrão da Rodag

Retorne APENAS JSON válido com esta estrutura:
{
  "summary": "resumo em 1 linha",
  "piece_type": "tipo",
  "format": "formato (ex: 1080x1080)",
  "goal": "objetivo",
  "audience": "público",
  "audience_profile": "perfil detalhado",
  "product": "produto/linha",
  "offer": "oferta se houver",
  "mandatory_elements": ["lista"],
  "tone": "tom",
  "cta": "call to action",
  "restrictions": ["lista"],
  "brand_context": "contexto da marca aplicável"
}`;

export async function runBriefingAgent(
  requestId: string,
  userId: string,
  originalMessage: string,
  questionsAndAnswers: { question: string; answer: string }[]
): Promise<BriefingResult> {
  const supabase = createAdminClient();

  await supabase.from("agent_runs").insert({
    request_id: requestId,
    agent_name: "briefing_agent",
    input_payload: { originalMessage, questionsAndAnswers },
    run_status: "running",
    model_used: "claude-sonnet-4-6-20250514",
  });

  const qaText = questionsAndAnswers
    .map((qa, i) => `P${i + 1}: ${qa.question}\nR${i + 1}: ${qa.answer}`)
    .join("\n\n");

  const userContent = `Mensagem original do cliente:\n"${originalMessage}"\n\n${qaText ? `Perguntas e respostas complementares:\n${qaText}` : ""}`;

  try {
    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in briefing response");

    const result: BriefingResult = JSON.parse(jsonMatch[0]);

    await supabase.from("request_briefings").insert({
      request_id: requestId,
      summary: result.summary,
      piece_type: result.piece_type,
      format: result.format,
      goal: result.goal,
      audience: result.audience,
      audience_profile: result.audience_profile,
      product: result.product,
      offer: result.offer,
      mandatory_elements: result.mandatory_elements as unknown as Json,
      tone: result.tone,
      cta: result.cta,
      restrictions: result.restrictions as unknown as Json,
      brand_context: result.brand_context,
      structured_brief_json: result as unknown as Json,
      is_final: true,
    });

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    await supabase
      .from("agent_runs")
      .update({
        output_payload: result as unknown as Json,
        run_status: "completed",
        finished_at: new Date().toISOString(),
        tokens_used: tokensUsed,
        cost_usd: tokensUsed * 0.000005,
      })
      .eq("request_id", requestId)
      .eq("agent_name", "briefing_agent");

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "briefing_completed",
      description: result.summary,
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
      .eq("agent_name", "briefing_agent");
    throw error;
  }
}
