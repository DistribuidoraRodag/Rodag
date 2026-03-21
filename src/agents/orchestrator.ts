import { createAdminClient } from "@/lib/supabase/admin";
import { runBriefingAgent } from "./briefing";
import { runStrategyCopyAgent } from "./strategy-copy";
import { runCreativeAgent } from "./creative";
import { runQADeliveryAgent } from "./qa-delivery";
import { isVisualPiece } from "./types";
import type { CreativeResult } from "./types";

export async function runOrchestrator(
  requestId: string,
  userId: string,
  initialMessage?: string
): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Get request data
    const { data: request } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (!request) throw new Error("Request not found");

    const message = initialMessage ?? request.initial_message;

    await supabase
      .from("requests")
      .update({ status: "briefing_em_montagem", last_completed_step: "intake" })
      .eq("id", requestId);

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "orchestrator_started",
      description: "Orquestrador iniciado",
    });

    // Step 1: Get Q&A pairs
    const { data: questions } = await supabase
      .from("request_questions")
      .select("question_text, answer_text")
      .eq("request_id", requestId)
      .not("answer_text", "is", null);

    const answeredQA = (questions ?? []).map((q) => ({
      question: q.question_text,
      answer: q.answer_text!,
    }));

    // Step 2: Briefing Agent
    const briefing = await runBriefingAgent(requestId, userId, message, answeredQA);

    await supabase
      .from("requests")
      .update({ status: "briefing_fechado", last_completed_step: "briefing" })
      .eq("id", requestId);

    // Step 3: Strategy + Copy Agent (GPT-4o)
    await supabase
      .from("requests")
      .update({ status: "em_processamento_multiagente" })
      .eq("id", requestId);

    // Run Strategy+Copy and Creative in parallel if visual piece
    const isVisual = isVisualPiece(briefing.piece_type);

    let creative: CreativeResult | null = null;
    let imageUrl: string | null = null;

    if (isVisual) {
      // Run both in parallel
      const [strategyCopy, creativeResult] = await Promise.all([
        runStrategyCopyAgent(requestId, briefing),
        (async () => {
          // Creative needs strategyCopy, so we run it after
          // Actually we need strategyCopy first for creative direction
          // So we can't fully parallelize — run strategy first
          return null as CreativeResult | null;
        })(),
      ]);

      await supabase
        .from("requests")
        .update({ status: "copy_pronta", last_completed_step: "strategy_copy" })
        .eq("id", requestId);

      // Now run Creative with the strategyCopy output
      creative = await runCreativeAgent(requestId, briefing, strategyCopy);

      await supabase
        .from("requests")
        .update({ status: "direcao_criativa_pronta", last_completed_step: "creative" })
        .eq("id", requestId);

      // TODO: Image Generation (Ideogram) — Phase 5
      // imageUrl = await runImageGeneration(requestId, creative.image_prompt);
      // await supabase.from("requests").update({ status: "imagem_gerada" }).eq("id", requestId);

      // Step 4: QA + Delivery
      await supabase
        .from("requests")
        .update({ status: "entrega_em_validacao" })
        .eq("id", requestId);

      const { qa } = await runQADeliveryAgent(
        requestId, userId, briefing, strategyCopy, creative, imageUrl
      );

      // Handle QA result
      await handleQAResult(requestId, userId, qa, briefing, creative, request.revision_count);
    } else {
      // Text-only piece — no creative needed
      const strategyCopy = await runStrategyCopyAgent(requestId, briefing);

      await supabase
        .from("requests")
        .update({ status: "copy_pronta", last_completed_step: "strategy_copy" })
        .eq("id", requestId);

      await supabase
        .from("requests")
        .update({ status: "entrega_em_validacao" })
        .eq("id", requestId);

      const { qa } = await runQADeliveryAgent(
        requestId, userId, briefing, strategyCopy, null, null
      );

      await handleQAResult(requestId, userId, qa, briefing, null, request.revision_count);
    }

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "orchestrator_completed",
      description: "Orquestrador finalizado com sucesso",
    });
  } catch (error) {
    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "orchestrator_error",
      description: `Erro: ${String(error)}`,
    });
    throw error;
  }
}

async function handleQAResult(
  requestId: string,
  userId: string,
  qa: { score: number; approved: boolean; feedback: string },
  briefing: { piece_type: string; summary: string },
  creative: CreativeResult | null,
  currentRevisionCount: number
) {
  const supabase = createAdminClient();

  if (qa.approved) {
    await supabase
      .from("requests")
      .update({ status: "entrega_finalizada", last_completed_step: "qa_delivery" })
      .eq("id", requestId);

    await supabase
      .from("requests")
      .update({ status: "entregue_ao_cliente" })
      .eq("id", requestId);
  } else if (currentRevisionCount < 2) {
    // Retry with QA feedback
    await supabase
      .from("requests")
      .update({
        status: "precisa_revisao",
        revision_count: currentRevisionCount + 1,
      })
      .eq("id", requestId);

    await supabase.from("request_events").insert({
      request_id: requestId,
      event_type: "qa_retry",
      description: `Score ${qa.score}/10. Tentativa ${currentRevisionCount + 1}/2. Feedback: ${qa.feedback}`,
    });

    // Re-run from strategy+copy with feedback appended to briefing
    const revisedBriefing = {
      ...briefing,
      tone: `${briefing.piece_type}. QA feedback para correção: ${qa.feedback}`,
    };

    const revisedCopy = await runStrategyCopyAgent(requestId, revisedBriefing as any);

    let revisedCreative: CreativeResult | null = null;
    if (creative) {
      revisedCreative = await runCreativeAgent(requestId, revisedBriefing as any, revisedCopy);
    }

    await runQADeliveryAgent(requestId, userId, revisedBriefing as any, revisedCopy, revisedCreative, null);

    await supabase
      .from("requests")
      .update({ status: "entrega_finalizada", last_completed_step: "qa_delivery" })
      .eq("id", requestId);

    await supabase
      .from("requests")
      .update({ status: "entregue_ao_cliente" })
      .eq("id", requestId);
  } else {
    // Max retries — flag for human review
    await supabase
      .from("requests")
      .update({
        status: "entrega_finalizada",
        needs_human_review: true,
        last_completed_step: "qa_delivery",
      })
      .eq("id", requestId);

    await supabase
      .from("requests")
      .update({ status: "entregue_ao_cliente" })
      .eq("id", requestId);
  }
}
