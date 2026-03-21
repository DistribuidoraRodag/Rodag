import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingResult, StrategyCopyResult, CreativeResult, QAResult } from "./types";
import type { Json } from "@/types/database";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const SYSTEM_PROMPT = `Você é o QA + Delivery Agent do RODAG MKT SYSTEM.

Sua função: validar a qualidade da entrega e formatar a resposta final para o cliente.

Critérios de validação:
1. Objetivo atendido? (a peça faz o que o briefing pediu?)
2. Público correto? (linguagem adequada para o público-alvo?)
3. CTA presente e específico?
4. Informações obrigatórias incluídas?
5. Tom adequado ao segmento B2B diesel?
6. Copy e visual alinhados? (se houver direção criativa)

Score: 1-10. Score >= 7 = aprovado. Score < 7 = precisa revisão.

Retorne APENAS JSON válido:
{
  "score": 8,
  "approved": true,
  "checklist": {
    "objective_met": true,
    "audience_correct": true,
    "cta_present": true,
    "mandatory_info_included": true,
    "tone_adequate": true,
    "copy_visual_aligned": true
  },
  "issues": [],
  "feedback": "feedback geral"
}`;

export async function runQADeliveryAgent(
  requestId: string,
  userId: string,
  briefing: BriefingResult,
  strategyCopy: StrategyCopyResult,
  creative: CreativeResult | null,
  imageUrl: string | null
): Promise<{ qa: QAResult; delivery: string }> {
  const supabase = createAdminClient();

  await supabase.from("agent_runs").insert({
    request_id: requestId,
    agent_name: "qa_delivery_agent",
    input_payload: { briefing, strategyCopy, creative, imageUrl } as unknown as Json,
    run_status: "running",
    model_used: "claude-sonnet-4-6-20250514",
  });

  try {
    const userContent = `Briefing original: ${JSON.stringify(briefing, null, 2)}
Strategy + Copy: ${JSON.stringify(strategyCopy, null, 2)}
${creative ? `Direção criativa: ${JSON.stringify(creative, null, 2)}` : ""}
${imageUrl ? `Imagem gerada: ${imageUrl}` : ""}`;

    const qaResponse = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const qaText = qaResponse.content[0].type === "text" ? qaResponse.content[0].text : "";
    const jsonMatch = qaText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in QA response");

    const qa: QAResult = JSON.parse(jsonMatch[0]);

    // Build delivery markdown
    const parts: string[] = [];

    parts.push(`## Entrega Concluída — ${briefing.summary}\n\n---\n`);

    parts.push(`### Resumo do Briefing\n`);
    parts.push(`**Peça:** ${briefing.piece_type} | **Formato:** ${briefing.format}`);
    parts.push(`**Objetivo:** ${briefing.goal}`);
    parts.push(`**Público:** ${briefing.audience}`);
    parts.push(`**Produto:** ${briefing.product}`);
    if (briefing.offer) parts.push(`**Oferta:** ${briefing.offer}`);
    parts.push(`\n---\n`);

    parts.push(`### Estratégia\n`);
    parts.push(`**Ângulo:** ${strategyCopy.strategy.angle}`);
    parts.push(`**Proposta de valor:** ${strategyCopy.strategy.value_prop}`);
    parts.push(`**Gatilho:** ${strategyCopy.strategy.trigger}`);
    parts.push(`\n---\n`);

    parts.push(`### Copy da Peça\n`);
    parts.push(`**Headline 1:** ${strategyCopy.copy.headline_1}`);
    parts.push(`**Headline 2:** ${strategyCopy.copy.headline_2}`);
    parts.push(`\n**Texto principal:**\n${strategyCopy.copy.body}`);
    parts.push(`\n**Legenda curta:**\n${strategyCopy.copy.caption_short}`);
    parts.push(`\n**Legenda longa:**\n${strategyCopy.copy.caption_long}`);
    parts.push(`\n**CTA principal:** ${strategyCopy.copy.cta_primary}`);
    parts.push(`**CTA alternativo:** ${strategyCopy.copy.cta_secondary}`);
    parts.push(`**Mensagem WhatsApp:** _${strategyCopy.copy.cta_whatsapp}_`);
    parts.push(`\n---\n`);

    if (creative) {
      parts.push(`### Direção Criativa Visual\n`);
      parts.push(`**Estilo:** ${creative.visual_direction.style}`);
      parts.push(`**Cores:** ${creative.visual_direction.colors.join(", ")}`);
      parts.push(`**Hierarquia:** ${creative.visual_direction.hierarchy.join(" → ")}`);
      parts.push(`\n**Instrução para designer:**\n${creative.designer_instruction}`);
      parts.push(`\n**Prompt para IA de imagem:**\n\`\`\`\n${creative.image_prompt}\n\`\`\``);

      if (imageUrl) {
        parts.push(`\n**Imagem gerada:**\n![Arte gerada](${imageUrl})`);
      }
      parts.push(`\n---\n`);
    }

    parts.push(`### Validação de Qualidade\n`);
    parts.push(`**Score:** ${qa.score}/10 ${qa.approved ? "Aprovado" : "Requer revisão"}`);
    if (qa.issues.length > 0) {
      parts.push(`\n**Pontos de atenção:**`);
      qa.issues.forEach((issue) => parts.push(`- ${issue}`));
    }
    parts.push(`\n---\n`);

    parts.push(`### Próximos Passos\n`);
    if (creative) {
      parts.push(`1. Use o **prompt de imagem** no Canva, Midjourney ou DALL-E para gerar o visual`);
      parts.push(`2. Aplique a **instrução de layout** para montar a peça`);
    }
    parts.push(`${creative ? "3" : "1"}. Use a **legenda longa** no Instagram e a **curta** no WhatsApp`);
    parts.push(`${creative ? "4" : "2"}. Teste o **CTA WhatsApp** com link direto para seu número`);

    const deliveryText = parts.join("\n");

    // Save full delivery
    await supabase.from("deliverables").insert({
      request_id: requestId,
      deliverable_type: "full_delivery",
      title: briefing.summary,
      content_json: { briefing, strategyCopy, creative, qa, imageUrl } as unknown as Json,
      content_text: deliveryText,
      image_url: imageUrl,
      qa_score: qa.score,
      qa_feedback: qa.feedback,
      approved: qa.approved,
    });

    // Save as chat message
    await supabase.from("chat_messages").insert({
      request_id: requestId,
      user_id: userId,
      role: "assistant",
      content: deliveryText,
      message_type: "delivery",
      metadata: { qa_score: qa.score, approved: qa.approved } as unknown as Json,
    });

    const tokensUsed = qaResponse.usage.input_tokens + qaResponse.usage.output_tokens;
    await supabase
      .from("agent_runs")
      .update({
        output_payload: { qa } as unknown as Json,
        run_status: "completed",
        finished_at: new Date().toISOString(),
        tokens_used: tokensUsed,
        cost_usd: tokensUsed * 0.000005,
      })
      .eq("request_id", requestId)
      .eq("agent_name", "qa_delivery_agent");

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "delivery_completed",
      description: `Score QA: ${qa.score}/10`,
      payload: { qa } as unknown as Json,
    });

    return { qa, delivery: deliveryText };
  } catch (error) {
    await supabase
      .from("agent_runs")
      .update({
        run_status: "failed",
        error_message: String(error),
        finished_at: new Date().toISOString(),
      })
      .eq("request_id", requestId)
      .eq("agent_name", "qa_delivery_agent");
    throw error;
  }
}
