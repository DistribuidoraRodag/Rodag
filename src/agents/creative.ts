import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { RODAG_BRAND_CONTEXT } from "./brand-context";
import type { BriefingResult, StrategyCopyResult, CreativeResult } from "./types";
import type { Json } from "@/types/database";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const SYSTEM_PROMPT = `Você é o Creative Direction Agent do RODAG MKT SYSTEM.

Sua função: produzir toda a direção visual da peça de marketing.

Contexto da marca Rodag:
${RODAG_BRAND_CONTEXT}

Formatos padrão:
- Feed Instagram: 1080x1080
- Story: 1080x1920
- Banner web: 1200x628
- WhatsApp: 800x800

Regras:
- Hierarquia visual clara: headline → produto → preço → CTA → logo
- Prompt de imagem em inglês, otimizado para Ideogram/Midjourney/DALL-E
- O prompt DEVE incluir texto legível que precisa aparecer na arte (preço, CTA, telefone)
- Instrução para designer em português, detalhada e aplicável
- Visual deve reforçar a copy, não contradizer

Retorne APENAS JSON válido:
{
  "visual_direction": {
    "style": "estilo visual",
    "colors": ["cor1", "cor2"],
    "hierarchy": ["elemento1", "elemento2"],
    "mood": "clima visual"
  },
  "layout": {
    "format": "1080x1080",
    "top": "o que vai no topo",
    "center": "o que vai no centro",
    "bottom_left": "inferior esquerdo",
    "bottom_right": "inferior direito",
    "corner": "canto (logo)"
  },
  "image_prompt": "prompt em inglês para IA de imagem",
  "designer_instruction": "instrução detalhada em português"
}`;

export async function runCreativeAgent(
  requestId: string,
  briefing: BriefingResult,
  strategyCopy: StrategyCopyResult
): Promise<CreativeResult> {
  const supabase = createAdminClient();

  await supabase.from("agent_runs").insert({
    request_id: requestId,
    agent_name: "creative_agent",
    input_payload: { briefing, strategyCopy } as unknown as Json,
    run_status: "running",
    model_used: "claude-sonnet-4-6-20250514",
  });

  try {
    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Briefing: ${JSON.stringify(briefing, null, 2)}\n\nCopy produzida: ${JSON.stringify(strategyCopy.copy, null, 2)}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in creative response");

    const result: CreativeResult = JSON.parse(jsonMatch[0]);

    await supabase.from("deliverables").insert({
      request_id: requestId,
      deliverable_type: "creative_direction",
      title: "Direção Criativa Visual",
      content_json: result as unknown as Json,
      content_text: result.designer_instruction,
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
      .eq("agent_name", "creative_agent");

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "creative_completed",
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
      .eq("agent_name", "creative_agent");
    throw error;
  }
}
