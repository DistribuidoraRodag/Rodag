import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntakeResult } from "./types";
import type { Json } from "@/types/database";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const SYSTEM_PROMPT = `Você é o Intake Agent do RODAG MKT SYSTEM — uma plataforma de produção de peças de marketing para distribuidora de autopeças diesel B2B.

Sua função: analisar a mensagem do cliente, extrair o máximo de informação possível e identificar o que está faltando.

Categorias de tipo de peça: instagram_post, story, banner, anuncio, whatsapp_message, carrossel, campanha, legenda, roteiro, catalogo
Objetivos possíveis: vender, promover, fortalecer_marca, gerar_orcamento, anunciar_produto, reativar_clientes
Públicos possíveis: oficinas_mecanicas, lojistas, transportadoras, frotistas, cliente_final

Campos obrigatórios para briefing completo: tipo_peca, objetivo, produto, publico
Campos complementares: preco, cta, prazo, marca_produto, telefone

Regras para perguntas:
- Faça APENAS as perguntas para campos realmente faltantes
- Máximo 5 perguntas, mínimo 0
- Se o cliente já informou tipo + objetivo + produto + público → needs_followup: false, questions: []
- Perguntas em português, linguagem direta e profissional
- Não pergunte o que já foi respondido na mensagem

Retorne APENAS JSON válido com esta estrutura:
{
  "request_type": "string ou null",
  "marketing_goal": "string ou null",
  "product_line": "string ou null",
  "target_audience": "string ou null",
  "mandatory_info": { "price": "string ou null", "cta": "string ou null", "brand": "string ou null" },
  "confidence": 0.0,
  "missing_fields": [],
  "questions": [],
  "needs_followup": true
}`;

export async function runIntakeAgent(
  requestId: string,
  userId: string,
  message: string
): Promise<IntakeResult> {
  const supabase = createAdminClient();

  // Log agent run start
  await supabase.from("agent_runs").insert({
    request_id: requestId,
    agent_name: "intake_agent",
    input_payload: { message } as unknown as Json,
    run_status: "running",
    model_used: "claude-haiku-4-5-20251001",
  });

  try {
    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result: IntakeResult = JSON.parse(jsonMatch[0]);

    // Update request fields
    await supabase
      .from("requests")
      .update({
        request_type: result.request_type,
        marketing_goal: result.marketing_goal,
        product_line: result.product_line,
        target_audience: result.target_audience,
      })
      .eq("id", requestId);

    // Save questions
    if (result.questions.length > 0) {
      const questions = result.questions.map((q, i) => ({
        request_id: requestId,
        question_order: i + 1,
        question_text: q,
      }));
      await supabase.from("request_questions").insert(questions);
    }

    // Update status
    if (result.needs_followup && result.questions.length > 0) {
      await supabase
        .from("requests")
        .update({ status: "aguardando_complemento" })
        .eq("id", requestId);

      // Send questions as chat message
      const questionsText = result.questions
        .map((q, i) => `**${i + 1}.** ${q}`)
        .join("\n");
      await supabase.from("chat_messages").insert({
        request_id: requestId,
        user_id: userId,
        role: "assistant",
        content: `Entendi seu pedido! Para criar a melhor peça possível, preciso de mais algumas informações:\n\n${questionsText}`,
        message_type: "question",
        metadata: { questions: result.questions } as unknown as Json,
      });
    } else {
      await supabase
        .from("requests")
        .update({ status: "briefing_em_montagem" })
        .eq("id", requestId);

      await supabase.from("chat_messages").insert({
        request_id: requestId,
        user_id: userId,
        role: "assistant",
        content: "Perfeito! Tenho todas as informações necessárias. Iniciando a produção da sua peça...",
        message_type: "status_update",
      });
    }

    // Log completion
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    await supabase
      .from("agent_runs")
      .update({
        output_payload: result as unknown as Json,
        run_status: "completed",
        finished_at: new Date().toISOString(),
        tokens_used: tokensUsed,
        cost_usd: tokensUsed * 0.000001, // Haiku estimate
      })
      .eq("request_id", requestId)
      .eq("agent_name", "intake_agent");

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "intake_completed",
      description: `Intake concluído. Campos faltantes: ${result.missing_fields.join(", ") || "nenhum"}`,
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
      .eq("agent_name", "intake_agent");

    throw error;
  }
}
