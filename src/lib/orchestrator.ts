// ============================================
// RODAG MKT SYSTEM — Orchestrator
// State-machine driven pipeline that processes
// requests through the multi-agent system.
// ============================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  runIntakeAgent,
  runBriefingAgent,
  runStrategyCopyAgent,
  runCreativeAgent,
  runQAAgent,
} from "@/lib/agents";
import type {
  IntakeOutput,
  BriefingOutput,
  StrategyCopyOutput,
  CreativeOutput,
  QAOutput,
  AgentName,
  RequestStatus,
  AgentResult,
} from "@/types/agents";
import type { Json } from "@/types/database";

const VISUAL_PIECE_TYPES = [
  "instagram_post",
  "story",
  "banner",
  "carrossel",
  "anuncio",
  "post",
];

function isVisualPiece(pieceType: string): boolean {
  return VISUAL_PIECE_TYPES.some((t) =>
    pieceType.toLowerCase().includes(t)
  );
}

// ── Helpers ─────────────────────────────────

async function updateStatus(
  requestId: string,
  status: RequestStatus,
  extra: Record<string, unknown> = {}
) {
  const supabase = createAdminClient();
  await supabase
    .from("requests")
    .update({ status, ...extra })
    .eq("id", requestId);
}

async function logEvent(
  requestId: string,
  eventType: string,
  description: string,
  payload?: unknown
) {
  const supabase = createAdminClient();
  await supabase.from("request_events").insert({
    request_id: requestId,
    event_type: eventType,
    description,
    payload: (payload ?? null) as unknown as Json,
  });
}

async function saveAgentRun(
  requestId: string,
  agentName: string,
  input: unknown,
  modelUsed: string
): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_runs")
    .insert({
      request_id: requestId,
      agent_name: agentName,
      input_payload: input as unknown as Json,
      run_status: "running",
      model_used: modelUsed,
    })
    .select("id")
    .single();
  return data?.id ?? "";
}

async function completeAgentRun(
  runId: string,
  result: AgentResult<unknown>
) {
  if (!runId) return;
  const supabase = createAdminClient();
  await supabase
    .from("agent_runs")
    .update({
      output_payload: result.output as unknown as Json,
      run_status: result.success ? "completed" : "failed",
      error_message: result.error ?? null,
      finished_at: new Date().toISOString(),
      tokens_used: result.tokens_used ?? null,
      cost_usd: result.cost_usd ?? null,
    })
    .eq("id", runId);
}

async function failAgentRun(runId: string, error: string) {
  if (!runId) return;
  const supabase = createAdminClient();
  await supabase
    .from("agent_runs")
    .update({
      run_status: "failed",
      error_message: error,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

// ── Main Orchestrator ───────────────────────

export async function processRequest(requestId: string): Promise<void> {
  const supabase = createAdminClient();

  // Fetch current request state
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error(`Request not found: ${requestId}`);
  }

  let currentStatus = request.status as RequestStatus;
  let keepProcessing = true;

  await logEvent(requestId, "orchestrator_started", `Processando status: ${currentStatus}`);

  while (keepProcessing) {
    try {
      switch (currentStatus) {
        // ── INTAKE ────────────────────────────
        case "novo_pedido": {
          const runId = await saveAgentRun(
            requestId,
            "intake",
            { message: request.initial_message },
            "claude-haiku-4-5-20251001"
          );

          const intakeResult = await runIntakeAgent(request.initial_message);
          await completeAgentRun(runId, intakeResult);

          if (!intakeResult.success || !intakeResult.output) {
            await failAgentRun(runId, intakeResult.error ?? "Unknown intake error");
            await logEvent(requestId, "intake_failed", intakeResult.error ?? "Intake agent failed");
            keepProcessing = false;
            break;
          }

          const intake = intakeResult.output;

          // Update request with extracted fields
          await supabase
            .from("requests")
            .update({
              request_type: intake.request_type,
              marketing_goal: intake.marketing_goal,
              product_line: intake.product_line,
              target_audience: intake.target_audience,
            })
            .eq("id", requestId);

          if (intake.needs_followup_questions && intake.questions.length > 0) {
            // Save questions to DB
            const questions = intake.questions.map((q, i) => ({
              request_id: requestId,
              question_order: i + 1,
              question_text: q,
            }));
            await supabase.from("request_questions").insert(questions);

            // Send assistant message with the questions
            const questionsText = intake.questions
              .map((q, i) => `**${i + 1}.** ${q}`)
              .join("\n");
            await supabase.from("chat_messages").insert({
              request_id: requestId,
              user_id: request.user_id,
              role: "assistant",
              content: `Entendi seu pedido! Para criar a melhor peça possível, preciso de mais algumas informações:\n\n${questionsText}`,
              message_type: "question",
              metadata: { questions: intake.questions } as unknown as Json,
            });

            await updateStatus(requestId, "aguardando_complemento", {
              last_completed_step: "intake",
            });
            await logEvent(
              requestId,
              "intake_completed",
              `Aguardando complemento. Perguntas: ${intake.questions.length}`,
              intake
            );

            // Stop processing — wait for user answers
            keepProcessing = false;
          } else {
            // No questions needed — move to briefing
            await updateStatus(requestId, "briefing_em_montagem", {
              last_completed_step: "intake",
            });
            await logEvent(requestId, "intake_completed", "Intake completo, sem perguntas pendentes", intake);
            currentStatus = "briefing_em_montagem";
          }
          break;
        }

        // ── BRIEFING ──────────────────────────
        case "briefing_em_montagem": {
          // Gather conversation messages
          const { data: chatMessages } = await supabase
            .from("chat_messages")
            .select("role, content")
            .eq("request_id", requestId)
            .order("created_at", { ascending: true });

          const messages = (chatMessages ?? []).map((m) => ({
            role: m.role,
            content: m.content,
          }));

          // Add the original message if no chat messages exist
          if (messages.length === 0) {
            messages.push({ role: "user", content: request.initial_message });
          }

          // Get intake output from the last agent run
          const { data: intakeRun } = await supabase
            .from("agent_runs")
            .select("output_payload")
            .eq("request_id", requestId)
            .eq("agent_name", "intake")
            .eq("run_status", "completed")
            .order("started_at", { ascending: false })
            .limit(1)
            .single();

          const intakeOutput: IntakeOutput = (intakeRun?.output_payload as unknown as IntakeOutput) ?? {
            request_type: request.request_type,
            marketing_goal: request.marketing_goal,
            product_line: request.product_line,
            target_audience: request.target_audience,
            known_fields: [],
            missing_fields: [],
            needs_followup_questions: false,
            questions: [],
            confidence: 0.5,
          };

          const runId = await saveAgentRun(
            requestId,
            "briefing",
            { messages, intakeOutput },
            "claude-sonnet-4-6-20250514"
          );

          const briefingResult = await runBriefingAgent(messages, intakeOutput);
          await completeAgentRun(runId, briefingResult);

          if (!briefingResult.success || !briefingResult.output) {
            await failAgentRun(runId, briefingResult.error ?? "Unknown briefing error");
            await logEvent(requestId, "briefing_failed", briefingResult.error ?? "Briefing agent failed");
            keepProcessing = false;
            break;
          }

          const briefing = briefingResult.output;

          // Save briefing to DB
          await supabase.from("request_briefings").insert({
            request_id: requestId,
            summary: briefing.summary,
            piece_type: briefing.piece_type,
            format: briefing.format,
            goal: briefing.goal,
            audience: briefing.audience,
            audience_profile: briefing.audience_profile,
            product: briefing.product,
            offer: briefing.offer,
            mandatory_elements: briefing.mandatory_elements as unknown as Json,
            tone: briefing.tone,
            cta: briefing.cta,
            restrictions: briefing.restrictions as unknown as Json,
            brand_context: briefing.brand_context,
            structured_brief_json: briefing as unknown as Json,
            is_final: true,
          });

          await updateStatus(requestId, "briefing_fechado", {
            last_completed_step: "briefing",
          });
          await logEvent(requestId, "briefing_completed", briefing.summary, briefing);
          currentStatus = "briefing_fechado";
          break;
        }

        // ── STRATEGY + COPY ───────────────────
        case "briefing_fechado": {
          const briefing = await getLatestBriefing(requestId);
          if (!briefing) {
            await logEvent(requestId, "error", "Briefing not found for strategy+copy");
            keepProcessing = false;
            break;
          }

          const runId = await saveAgentRun(
            requestId,
            "strategy_copy",
            briefing,
            "gpt-4o"
          );

          const copyResult = await runStrategyCopyAgent(briefing);
          await completeAgentRun(runId, copyResult);

          if (!copyResult.success || !copyResult.output) {
            await failAgentRun(runId, copyResult.error ?? "Unknown strategy+copy error");
            await logEvent(requestId, "strategy_copy_failed", copyResult.error ?? "Strategy+copy agent failed");
            keepProcessing = false;
            break;
          }

          // Save copy as deliverable
          await supabase.from("deliverables").insert({
            request_id: requestId,
            deliverable_type: "strategy",
            title: "Estratégia + Copy",
            content_json: copyResult.output as unknown as Json,
            content_text: `${copyResult.output.copy.headline_1}\n${copyResult.output.copy.body}`,
          });

          await updateStatus(requestId, "copy_pronta", {
            last_completed_step: "strategy_copy",
          });
          await logEvent(requestId, "strategy_copy_completed", "Copy produzida", copyResult.output);
          currentStatus = "copy_pronta";
          break;
        }

        // ── CREATIVE (conditional) ────────────
        case "copy_pronta": {
          const briefing = await getLatestBriefing(requestId);
          if (!briefing) {
            await logEvent(requestId, "error", "Briefing not found for creative");
            keepProcessing = false;
            break;
          }

          if (isVisualPiece(briefing.piece_type)) {
            // Need creative direction
            const copy = await getLatestCopy(requestId);
            if (!copy) {
              await logEvent(requestId, "error", "Copy not found for creative");
              keepProcessing = false;
              break;
            }

            const runId = await saveAgentRun(
              requestId,
              "creative",
              { briefing, copy },
              "claude-sonnet-4-6-20250514"
            );

            const creativeResult = await runCreativeAgent(briefing, copy);
            await completeAgentRun(runId, creativeResult);

            if (!creativeResult.success || !creativeResult.output) {
              await failAgentRun(runId, creativeResult.error ?? "Unknown creative error");
              await logEvent(requestId, "creative_failed", creativeResult.error ?? "Creative agent failed");
              keepProcessing = false;
              break;
            }

            // Save creative as deliverable
            await supabase.from("deliverables").insert({
              request_id: requestId,
              deliverable_type: "creative_direction",
              title: "Direção Criativa Visual",
              content_json: creativeResult.output as unknown as Json,
              content_text: creativeResult.output.designer_instruction,
            });

            await updateStatus(requestId, "direcao_criativa_pronta", {
              last_completed_step: "creative",
            });
            await logEvent(requestId, "creative_completed", "Direção criativa concluída", creativeResult.output);
            currentStatus = "direcao_criativa_pronta";
          } else {
            // Non-visual piece — skip creative, go straight to QA
            await updateStatus(requestId, "entrega_em_validacao");
            await logEvent(requestId, "creative_skipped", "Peça não visual, pulando criativo");
            currentStatus = "entrega_em_validacao";
          }
          break;
        }

        // ── CREATIVE DONE → QA ────────────────
        case "direcao_criativa_pronta": {
          await updateStatus(requestId, "entrega_em_validacao");
          await logEvent(requestId, "status_transition", "Encaminhando para validação QA");
          currentStatus = "entrega_em_validacao";
          break;
        }

        // ── QA ────────────────────────────────
        case "entrega_em_validacao": {
          const briefing = await getLatestBriefing(requestId);
          const copy = await getLatestCopy(requestId);
          const creative = await getLatestCreative(requestId);

          if (!briefing || !copy) {
            await logEvent(requestId, "error", "Briefing or copy not found for QA");
            keepProcessing = false;
            break;
          }

          const runId = await saveAgentRun(
            requestId,
            "qa",
            { briefing, copy, creative },
            "claude-sonnet-4-6-20250514"
          );

          const qaResult = await runQAAgent(briefing, copy, creative);
          await completeAgentRun(runId, qaResult);

          if (!qaResult.success || !qaResult.output) {
            await failAgentRun(runId, qaResult.error ?? "Unknown QA error");
            await logEvent(requestId, "qa_failed", qaResult.error ?? "QA agent failed");
            keepProcessing = false;
            break;
          }

          const qa = qaResult.output;

          // Refresh request to get current revision_count
          const { data: freshRequest } = await supabase
            .from("requests")
            .select("revision_count")
            .eq("id", requestId)
            .single();
          const revisionCount = freshRequest?.revision_count ?? 0;

          if (qa.passed) {
            // QA passed — finalize delivery
            await saveFullDelivery(requestId, request.user_id, briefing, copy, creative, qa);

            await updateStatus(requestId, "entrega_finalizada", {
              last_completed_step: "qa",
            });
            await logEvent(requestId, "qa_approved", `Score: ${qa.score}/10 — Aprovado`, qa);
            keepProcessing = false;
          } else if (revisionCount < 2) {
            // QA failed but can retry
            await updateStatus(requestId, "precisa_revisao", {
              revision_count: revisionCount + 1,
            });
            await logEvent(
              requestId,
              "qa_revision_needed",
              `Score: ${qa.score}/10. Revisão ${revisionCount + 1}/2. Feedback: ${qa.feedback}`,
              qa
            );
            currentStatus = "precisa_revisao";
          } else {
            // Max retries exhausted — finalize with human review flag
            await saveFullDelivery(requestId, request.user_id, briefing, copy, creative, qa);

            await updateStatus(requestId, "entrega_finalizada", {
              last_completed_step: "qa",
              needs_human_review: true,
            });
            await logEvent(
              requestId,
              "qa_max_retries",
              `Score: ${qa.score}/10. Máximo de revisões atingido. Encaminhado para revisão humana.`,
              qa
            );
            keepProcessing = false;
          }
          break;
        }

        // ── REVISION ──────────────────────────
        case "precisa_revisao": {
          const briefing = await getLatestBriefing(requestId);
          const creative = await getLatestCreative(requestId);

          if (!briefing) {
            await logEvent(requestId, "error", "Briefing not found for revision");
            keepProcessing = false;
            break;
          }

          // Get last QA feedback to append to briefing context
          const { data: lastQARun } = await supabase
            .from("agent_runs")
            .select("output_payload")
            .eq("request_id", requestId)
            .eq("agent_name", "qa")
            .eq("run_status", "completed")
            .order("started_at", { ascending: false })
            .limit(1)
            .single();

          const lastQA = lastQARun?.output_payload as unknown as QAOutput | null;
          const qaFeedback = lastQA?.feedback ?? "";

          // Augment briefing with QA feedback for revision
          const revisedBriefing: BriefingOutput = {
            ...briefing,
            brand_context: `${briefing.brand_context}\n\nFEEDBACK QA PARA CORREÇÃO: ${qaFeedback}`,
          };

          // Re-run strategy+copy with QA feedback
          const copyRunId = await saveAgentRun(
            requestId,
            "strategy_copy",
            revisedBriefing,
            "gpt-4o"
          );

          const copyResult = await runStrategyCopyAgent(revisedBriefing);
          await completeAgentRun(copyRunId, copyResult);

          if (!copyResult.success || !copyResult.output) {
            await failAgentRun(copyRunId, copyResult.error ?? "Revision copy failed");
            await logEvent(requestId, "revision_copy_failed", copyResult.error ?? "Revision strategy+copy failed");
            keepProcessing = false;
            break;
          }

          // Save revised copy
          await supabase.from("deliverables").insert({
            request_id: requestId,
            deliverable_type: "strategy",
            title: "Estratégia + Copy (revisada)",
            content_json: copyResult.output as unknown as Json,
            content_text: `${copyResult.output.copy.headline_1}\n${copyResult.output.copy.body}`,
          });

          // Re-run creative if it's a visual piece and creative existed
          if (creative && isVisualPiece(briefing.piece_type)) {
            const creativeRunId = await saveAgentRun(
              requestId,
              "creative",
              { briefing: revisedBriefing, copy: copyResult.output },
              "claude-sonnet-4-6-20250514"
            );

            const creativeResult = await runCreativeAgent(revisedBriefing, copyResult.output);
            await completeAgentRun(creativeRunId, creativeResult);

            if (!creativeResult.success || !creativeResult.output) {
              await failAgentRun(creativeRunId, creativeResult.error ?? "Revision creative failed");
              await logEvent(requestId, "revision_creative_failed", creativeResult.error ?? "Revision creative failed");
              keepProcessing = false;
              break;
            }

            await supabase.from("deliverables").insert({
              request_id: requestId,
              deliverable_type: "creative_direction",
              title: "Direção Criativa (revisada)",
              content_json: creativeResult.output as unknown as Json,
              content_text: creativeResult.output.designer_instruction,
            });
          }

          // Go back to QA
          await updateStatus(requestId, "entrega_em_validacao");
          await logEvent(requestId, "revision_completed", "Revisão concluída, re-validando QA");
          currentStatus = "entrega_em_validacao";
          break;
        }

        // ── TERMINAL / WAITING STATES ─────────
        case "aguardando_complemento":
        case "entrega_finalizada":
        case "entregue_ao_cliente":
        default: {
          keepProcessing = false;
          break;
        }
      }
    } catch (error) {
      await logEvent(
        requestId,
        "orchestrator_error",
        `Erro no status ${currentStatus}: ${String(error)}`
      );
      keepProcessing = false;
      throw error;
    }
  }

  await logEvent(requestId, "orchestrator_finished", `Finalizado no status: ${currentStatus}`);
}

// ── Data Fetchers ───────────────────────────

async function getLatestBriefing(requestId: string): Promise<BriefingOutput | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("request_briefings")
    .select("structured_brief_json")
    .eq("request_id", requestId)
    .eq("is_final", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (data?.structured_brief_json as unknown as BriefingOutput) ?? null;
}

async function getLatestCopy(requestId: string): Promise<StrategyCopyOutput | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deliverables")
    .select("content_json")
    .eq("request_id", requestId)
    .eq("deliverable_type", "strategy")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (data?.content_json as unknown as StrategyCopyOutput) ?? null;
}

async function getLatestCreative(requestId: string): Promise<CreativeOutput | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deliverables")
    .select("content_json")
    .eq("request_id", requestId)
    .eq("deliverable_type", "creative_direction")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (data?.content_json as unknown as CreativeOutput) ?? null;
}

async function saveFullDelivery(
  requestId: string,
  userId: string,
  briefing: BriefingOutput,
  copy: StrategyCopyOutput,
  creative: CreativeOutput | null,
  qa: QAOutput
) {
  const supabase = createAdminClient();

  // Build delivery markdown
  const parts: string[] = [];

  parts.push(`## Entrega Concluída — ${briefing.summary}\n\n---\n`);

  parts.push(`### Resumo do Briefing`);
  parts.push(`**Peça:** ${briefing.piece_type} | **Formato:** ${briefing.format}`);
  parts.push(`**Objetivo:** ${briefing.goal}`);
  parts.push(`**Público:** ${briefing.audience}`);
  parts.push(`**Produto:** ${briefing.product}`);
  if (briefing.offer) parts.push(`**Oferta:** ${briefing.offer}`);
  parts.push(`\n---\n`);

  parts.push(`### Estratégia`);
  parts.push(`**Ângulo:** ${copy.strategy.angle}`);
  parts.push(`**Proposta de valor:** ${copy.strategy.value_prop}`);
  parts.push(`**Gatilho:** ${copy.strategy.trigger}`);
  parts.push(`\n---\n`);

  parts.push(`### Copy da Peça`);
  parts.push(`**Headline 1:** ${copy.copy.headline_1}`);
  parts.push(`**Headline 2:** ${copy.copy.headline_2}`);
  parts.push(`\n**Texto principal:**\n${copy.copy.body}`);
  parts.push(`\n**Legenda curta:**\n${copy.copy.caption_short}`);
  parts.push(`\n**Legenda longa:**\n${copy.copy.caption_long}`);
  parts.push(`\n**CTA principal:** ${copy.copy.cta_primary}`);
  parts.push(`**CTA alternativo:** ${copy.copy.cta_secondary}`);
  parts.push(`**Mensagem WhatsApp:** _${copy.copy.cta_whatsapp}_`);
  parts.push(`\n---\n`);

  if (creative) {
    parts.push(`### Direção Criativa Visual`);
    parts.push(`**Estilo:** ${creative.visual_direction.style}`);
    parts.push(`**Cores:** ${creative.visual_direction.colors.join(", ")}`);
    parts.push(`**Hierarquia:** ${creative.visual_direction.hierarchy.join(" → ")}`);
    parts.push(`\n**Instrução para designer:**\n${creative.designer_instruction}`);
    parts.push(`\n**Prompt para IA de imagem:**\n\`\`\`\n${creative.image_prompt}\n\`\`\``);
    parts.push(`\n---\n`);
  }

  parts.push(`### Validação de Qualidade`);
  parts.push(`**Score:** ${qa.score}/10 ${qa.passed ? "Aprovado" : "Requer revisão"}`);
  if (qa.issues.length > 0) {
    parts.push(`\n**Pontos de atenção:**`);
    qa.issues.forEach((issue) => parts.push(`- ${issue}`));
  }

  const deliveryText = parts.join("\n");

  // Save full delivery as deliverable
  await supabase.from("deliverables").insert({
    request_id: requestId,
    deliverable_type: "full_delivery",
    title: briefing.summary,
    content_json: { briefing, copy, creative, qa } as unknown as Json,
    content_text: deliveryText,
    qa_score: qa.score,
    qa_feedback: qa.feedback,
    approved: qa.passed,
  });

  // Save as chat message for the user
  await supabase.from("chat_messages").insert({
    request_id: requestId,
    user_id: userId,
    role: "assistant",
    content: deliveryText,
    message_type: "delivery",
    metadata: { qa_score: qa.score, approved: qa.passed } as unknown as Json,
  });
}
