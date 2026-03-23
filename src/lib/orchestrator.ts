// ============================================
// RODAG MKT SYSTEM — Finite State Machine Orchestrator
// ============================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createUntypedAdminClient } from "@/lib/supabase/admin-untyped";
import { runIntakeAgent } from "@/lib/agents/intake";
import { runBriefingAgent } from "@/lib/agents/briefing";
import { runStrategyCopyAgent } from "@/lib/agents/strategy-copy";
import { runCreativeAgent } from "@/lib/agents/creative";
import { runQAAgent } from "@/lib/agents/qa";
import { ImageValidationService } from "@/lib/services/image-validation";
import { FallbackGenerator } from "@/lib/services/fallback-generator";
import type {
  IntakeOutput,
  BriefingOutput,
  StrategyCopyOutput,
  CreativeOutput,
  QAOutput,
  RequestStatus,
  AgentResult,
} from "@/types/agents";
import type { Json } from "@/types/database";

// ── FSM Types ───────────────────────────────

type WorkflowState =
  | "INTAKE"
  | "AWAITING_ANSWERS"
  | "BRIEFING"
  | "STRATEGY_COPY"
  | "CREATIVE"
  | "IMAGE_GEN"
  | "VALIDATION"
  | "CORRECTION"
  | "QA"
  | "FALLBACK"
  | "DELIVERY"
  | "COMPLETED"
  | "FAILED";

/** Maps FSM states to existing DB status values */
const STATE_TO_DB_STATUS: Record<WorkflowState, RequestStatus> = {
  INTAKE: "novo_pedido",
  AWAITING_ANSWERS: "aguardando_complemento",
  BRIEFING: "briefing_em_montagem",
  STRATEGY_COPY: "briefing_fechado",
  CREATIVE: "copy_pronta",
  IMAGE_GEN: "direcao_criativa_pronta",
  VALIDATION: "imagem_gerada",
  CORRECTION: "imagem_corrigida",
  QA: "entrega_em_validacao",
  FALLBACK: "entrega_em_validacao",
  DELIVERY: "entrega_finalizada",
  COMPLETED: "entregue_ao_cliente",
  FAILED: "precisa_revisao",
};

/** Maps DB status to FSM state for resumption */
const DB_STATUS_TO_STATE: Record<string, WorkflowState> = {
  novo_pedido: "INTAKE",
  aguardando_complemento: "AWAITING_ANSWERS",
  briefing_em_montagem: "BRIEFING",
  briefing_fechado: "STRATEGY_COPY",
  copy_pronta: "CREATIVE",
  direcao_criativa_pronta: "IMAGE_GEN",
  imagem_gerada: "VALIDATION",
  imagem_validada: "QA",
  imagem_corrigida: "CORRECTION",
  entrega_em_validacao: "QA",
  precisa_revisao: "STRATEGY_COPY",
  entrega_finalizada: "DELIVERY",
  entregue_ao_cliente: "COMPLETED",
};

/** Ordered states for skip logic */
const STATE_ORDER: WorkflowState[] = [
  "INTAKE",
  "AWAITING_ANSWERS",
  "BRIEFING",
  "STRATEGY_COPY",
  "CREATIVE",
  "IMAGE_GEN",
  "VALIDATION",
  "CORRECTION",
  "QA",
  "FALLBACK",
  "DELIVERY",
  "COMPLETED",
  "FAILED",
];

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

// ── Business Rules Context ──────────────────

interface BusinessRulesContext {
  brandRules: Record<string, unknown> | null;
  restrictedTerms: { term: string; severity: string }[];
}

// ── WorkflowOrchestrator Class ──────────────

class WorkflowOrchestrator {
  private requestId: string;
  private state: WorkflowState;
  private supabase: ReturnType<typeof createAdminClient>;
  private request: Record<string, unknown> = {};
  private businessRules: BusinessRulesContext = {
    brandRules: null,
    restrictedTerms: [],
  };
  private imageRetries = 0;
  private qaRetries = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private untypedDb: any;

  constructor(requestId: string, initialState: WorkflowState = "INTAKE") {
    this.requestId = requestId;
    this.state = initialState;
    this.supabase = createAdminClient();
    this.untypedDb = createUntypedAdminClient();
  }

  // ── State transition ────────────────────

  private async transitionTo(
    nextState: WorkflowState,
    reason: string
  ): Promise<void> {
    const fromState = this.state;
    this.state = nextState;

    const dbStatus = STATE_TO_DB_STATUS[nextState];

    // Record state transition in history
    await this.untypedDb.from("request_state_history").insert({
      request_id: this.requestId,
      from_state: fromState,
      to_state: nextState,
      reason,
    });

    // Update request status and last_completed_step
    await this.supabase
      .from("requests")
      .update({
        status: dbStatus,
        last_completed_step: fromState.toLowerCase(),
      })
      .eq("id", this.requestId);

    await this.logEvent(
      "state_transition",
      `${fromState} -> ${nextState}: ${reason}`
    );
  }

  // ── Logging ─────────────────────────────

  private async logEvent(
    eventType: string,
    description: string,
    payload?: unknown
  ): Promise<void> {
    await this.supabase.from("request_events").insert({
      request_id: this.requestId,
      event_type: eventType,
      description,
      payload: (payload ?? null) as unknown as Json,
    });
  }

  // ── Agent run tracking ──────────────────

  private async saveAgentRun(
    agentName: string,
    input: unknown,
    modelUsed: string
  ): Promise<string> {
    const { data } = await this.supabase
      .from("agent_runs")
      .insert({
        request_id: this.requestId,
        agent_name: agentName,
        input_payload: input as unknown as Json,
        run_status: "running",
        model_used: modelUsed,
      })
      .select("id")
      .single();
    return data?.id ?? "";
  }

  private async completeAgentRun(
    runId: string,
    result: AgentResult<unknown>
  ): Promise<void> {
    if (!runId) return;
    await this.supabase
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

  private async failAgentRun(runId: string, error: string): Promise<void> {
    if (!runId) return;
    await this.supabase
      .from("agent_runs")
      .update({
        run_status: "failed",
        error_message: error,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  // ── Data fetchers ───────────────────────

  private async getLatestBriefing(): Promise<BriefingOutput | null> {
    const { data } = await this.supabase
      .from("request_briefings")
      .select("structured_brief_json")
      .eq("request_id", this.requestId)
      .eq("is_final", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return (data?.structured_brief_json as unknown as BriefingOutput) ?? null;
  }

  private async getLatestCopy(): Promise<StrategyCopyOutput | null> {
    const { data } = await this.supabase
      .from("deliverables")
      .select("content_json")
      .eq("request_id", this.requestId)
      .eq("deliverable_type", "strategy")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return (data?.content_json as unknown as StrategyCopyOutput) ?? null;
  }

  private async getLatestCreative(): Promise<CreativeOutput | null> {
    const { data } = await this.supabase
      .from("deliverables")
      .select("content_json")
      .eq("request_id", this.requestId)
      .eq("deliverable_type", "creative_direction")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return (data?.content_json as unknown as CreativeOutput) ?? null;
  }

  private async getLatestQAFeedback(): Promise<string> {
    const { data } = await this.supabase
      .from("agent_runs")
      .select("output_payload")
      .eq("request_id", this.requestId)
      .eq("agent_name", "qa")
      .eq("run_status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();
    const lastQA = data?.output_payload as unknown as QAOutput | null;
    return lastQA?.feedback ?? "";
  }

  // ── Load business rules ─────────────────

  private async loadBusinessRules(): Promise<void> {
    const { data: brandRules } = await this.untypedDb
      .from("brand_rules")
      .select("*")
      .eq("is_active", true)
      .single();

    const { data: restrictedTerms } = await this.untypedDb
      .from("restricted_terms")
      .select("term, severity");

    this.businessRules = {
      brandRules: (brandRules as Record<string, unknown>) ?? null,
      restrictedTerms:
        (restrictedTerms as { term: string; severity: string }[]) ?? [],
    };
  }

  // ── Full delivery builder ───────────────

  private async saveFullDelivery(
    briefing: BriefingOutput,
    copy: StrategyCopyOutput,
    creative: CreativeOutput | null,
    qa: QAOutput,
    imageUrl?: string | null,
    needsHumanReview = false
  ): Promise<void> {
    const parts: string[] = [];

    parts.push(
      `## Entrega Concluida -- ${briefing.summary}\n\n---\n`
    );

    parts.push(`### Resumo do Briefing`);
    parts.push(
      `**Peca:** ${briefing.piece_type} | **Formato:** ${briefing.format}`
    );
    parts.push(`**Objetivo:** ${briefing.goal}`);
    parts.push(`**Publico:** ${briefing.audience}`);
    parts.push(`**Produto:** ${briefing.product}`);
    if (briefing.offer) parts.push(`**Oferta:** ${briefing.offer}`);
    parts.push(`\n---\n`);

    parts.push(`### Estrategia`);
    parts.push(`**Angulo:** ${copy.strategy.angle}`);
    parts.push(`**Proposta de valor:** ${copy.strategy.value_prop}`);
    parts.push(`**Gatilho:** ${copy.strategy.trigger}`);
    parts.push(`\n---\n`);

    parts.push(`### Copy da Peca`);
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
      parts.push(`### Direcao Criativa Visual`);
      parts.push(`**Estilo:** ${creative.visual_direction.style}`);
      parts.push(
        `**Cores:** ${creative.visual_direction.colors.join(", ")}`
      );
      parts.push(
        `**Hierarquia:** ${creative.visual_direction.hierarchy.join(" -> ")}`
      );
      parts.push(
        `\n**Instrucao para designer:**\n${creative.designer_instruction}`
      );
      parts.push(
        `\n**Prompt para IA de imagem:**\n\`\`\`\n${creative.image_prompt}\n\`\`\``
      );
      if (imageUrl) {
        parts.push(`\n**Imagem gerada:** ${imageUrl}`);
      }
      parts.push(`\n---\n`);
    }

    parts.push(`### Validacao de Qualidade`);
    parts.push(
      `**Score:** ${qa.score}/10 ${qa.passed ? "Aprovado" : "Requer revisao"}`
    );
    if (needsHumanReview) {
      parts.push(
        `\n**ATENCAO:** Entrega encaminhada para revisao humana.`
      );
    }
    if (qa.issues.length > 0) {
      parts.push(`\n**Pontos de atencao:**`);
      qa.issues.forEach((issue) => parts.push(`- ${issue}`));
    }

    const deliveryText = parts.join("\n");

    await this.supabase.from("deliverables").insert({
      request_id: this.requestId,
      deliverable_type: "full_delivery",
      title: briefing.summary,
      content_json: {
        briefing,
        copy,
        creative,
        qa,
        imageUrl,
      } as unknown as Json,
      content_text: deliveryText,
      qa_score: qa.score,
      qa_feedback: qa.feedback,
      approved: qa.passed,
    });

    const userId = this.request.user_id as string;
    await this.supabase.from("chat_messages").insert({
      request_id: this.requestId,
      user_id: userId,
      role: "assistant",
      content: deliveryText,
      message_type: "delivery",
      metadata: {
        qa_score: qa.score,
        approved: qa.passed,
        needs_human_review: needsHumanReview,
      } as unknown as Json,
    });
  }

  // ── State Handlers ──────────────────────

  private async handleIntake(): Promise<void> {
    const message = this.request.initial_message as string;

    const runId = await this.saveAgentRun(
      "intake",
      { message },
      "claude-haiku-4-5-20251001"
    );

    const intakeResult = await runIntakeAgent(message);
    await this.completeAgentRun(runId, intakeResult);

    if (!intakeResult.success || !intakeResult.output) {
      await this.failAgentRun(
        runId,
        intakeResult.error ?? "Unknown intake error"
      );
      throw new Error(
        `Intake failed: ${intakeResult.error ?? "Unknown error"}`
      );
    }

    const intake = intakeResult.output;

    // Update request with extracted fields
    await this.supabase
      .from("requests")
      .update({
        request_type: intake.request_type,
        marketing_goal: intake.marketing_goal,
        product_line: intake.product_line,
        target_audience: intake.target_audience,
      })
      .eq("id", this.requestId);

    if (intake.needs_followup_questions && intake.questions.length > 0) {
      // Save questions
      const questions = intake.questions.map((q, i) => ({
        request_id: this.requestId,
        question_order: i + 1,
        question_text: q,
      }));
      await this.supabase.from("request_questions").insert(questions);

      // Send assistant message with questions
      const questionsText = intake.questions
        .map((q, i) => `**${i + 1}.** ${q}`)
        .join("\n");
      await this.supabase.from("chat_messages").insert({
        request_id: this.requestId,
        user_id: this.request.user_id as string,
        role: "assistant",
        content: `Entendi seu pedido! Para criar a melhor peca possivel, preciso de mais algumas informacoes:\n\n${questionsText}`,
        message_type: "question",
        metadata: {
          questions: intake.questions,
        } as unknown as Json,
      });

      await this.transitionTo(
        "AWAITING_ANSWERS",
        `Aguardando complemento. Perguntas: ${intake.questions.length}`
      );
    } else {
      await this.transitionTo(
        "BRIEFING",
        "Intake completo, sem perguntas pendentes"
      );
    }
  }

  private async handleBriefing(): Promise<void> {
    // Gather conversation messages
    const { data: chatMessages } = await this.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("request_id", this.requestId)
      .order("created_at", { ascending: true });

    const messages = (chatMessages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (messages.length === 0) {
      messages.push({
        role: "user",
        content: this.request.initial_message as string,
      });
    }

    // Get intake output
    const { data: intakeRun } = await this.supabase
      .from("agent_runs")
      .select("output_payload")
      .eq("request_id", this.requestId)
      .eq("agent_name", "intake")
      .eq("run_status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const intakeOutput: IntakeOutput =
      (intakeRun?.output_payload as unknown as IntakeOutput) ?? {
        request_type: this.request.request_type as string | null,
        marketing_goal: this.request.marketing_goal as string | null,
        product_line: this.request.product_line as string | null,
        target_audience: this.request.target_audience as string | null,
        known_fields: [],
        missing_fields: [],
        needs_followup_questions: false,
        questions: [],
        confidence: 0.5,
      };

    const runId = await this.saveAgentRun(
      "briefing",
      { messages, intakeOutput, businessRules: this.businessRules },
      "claude-sonnet-4-6-20250514"
    );

    const briefingResult = await runBriefingAgent(messages, intakeOutput);
    await this.completeAgentRun(runId, briefingResult);

    if (!briefingResult.success || !briefingResult.output) {
      await this.failAgentRun(
        runId,
        briefingResult.error ?? "Unknown briefing error"
      );
      throw new Error(
        `Briefing failed: ${briefingResult.error ?? "Unknown error"}`
      );
    }

    const briefing = briefingResult.output;

    // Enrich briefing with business rules if available
    if (this.businessRules.restrictedTerms.length > 0) {
      const terms = this.businessRules.restrictedTerms
        .map((t) => t.term)
        .join(", ");
      briefing.restrictions = [
        ...briefing.restrictions,
        `Termos restritos da marca (nao usar): ${terms}`,
      ];
    }

    // Save briefing to DB
    await this.supabase.from("request_briefings").insert({
      request_id: this.requestId,
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

    await this.transitionTo("STRATEGY_COPY", briefing.summary);
  }

  private async handleStrategyCopy(): Promise<void> {
    const briefing = await this.getLatestBriefing();
    if (!briefing) {
      throw new Error("Briefing not found for strategy+copy");
    }

    // If this is a QA retry, augment briefing with QA feedback
    const qaFeedback = await this.getLatestQAFeedback();
    const effectiveBriefing: BriefingOutput =
      qaFeedback && this.qaRetries > 0
        ? {
            ...briefing,
            brand_context: `${briefing.brand_context}\n\nFEEDBACK QA PARA CORRECAO: ${qaFeedback}`,
          }
        : briefing;

    const runId = await this.saveAgentRun(
      "strategy_copy",
      { briefing: effectiveBriefing, businessRules: this.businessRules },
      "gpt-4o"
    );

    const copyResult = await runStrategyCopyAgent(effectiveBriefing);
    await this.completeAgentRun(runId, copyResult);

    if (!copyResult.success || !copyResult.output) {
      await this.failAgentRun(
        runId,
        copyResult.error ?? "Unknown strategy+copy error"
      );
      throw new Error(
        `Strategy+copy failed: ${copyResult.error ?? "Unknown error"}`
      );
    }

    // Save copy as deliverable
    const title =
      this.qaRetries > 0
        ? "Estrategia + Copy (revisada)"
        : "Estrategia + Copy";
    await this.supabase.from("deliverables").insert({
      request_id: this.requestId,
      deliverable_type: "strategy",
      title,
      content_json: copyResult.output as unknown as Json,
      content_text: `${copyResult.output.copy.headline_1}\n${copyResult.output.copy.body}`,
    });

    await this.transitionTo("CREATIVE", "Copy produzida");
  }

  private async handleCreative(): Promise<void> {
    const briefing = await this.getLatestBriefing();
    if (!briefing) {
      throw new Error("Briefing not found for creative");
    }

    if (!isVisualPiece(briefing.piece_type)) {
      // Non-visual piece -- skip creative and image gen, go to QA
      await this.transitionTo(
        "QA",
        "Peca nao visual, pulando criativo"
      );
      return;
    }

    const copy = await this.getLatestCopy();
    if (!copy) {
      throw new Error("Copy not found for creative");
    }

    const runId = await this.saveAgentRun(
      "creative",
      { briefing, copy },
      "claude-sonnet-4-6-20250514"
    );

    const creativeResult = await runCreativeAgent(briefing, copy);
    await this.completeAgentRun(runId, creativeResult);

    if (!creativeResult.success || !creativeResult.output) {
      await this.failAgentRun(
        runId,
        creativeResult.error ?? "Unknown creative error"
      );
      throw new Error(
        `Creative failed: ${creativeResult.error ?? "Unknown error"}`
      );
    }

    // Save creative as deliverable
    const title =
      this.qaRetries > 0
        ? "Direcao Criativa (revisada)"
        : "Direcao Criativa Visual";
    await this.supabase.from("deliverables").insert({
      request_id: this.requestId,
      deliverable_type: "creative_direction",
      title,
      content_json: creativeResult.output as unknown as Json,
      content_text: creativeResult.output.designer_instruction,
    });

    await this.transitionTo("IMAGE_GEN", "Direcao criativa concluida");
  }

  private async handleImageGen(): Promise<void> {
    const creative = await this.getLatestCreative();
    if (!creative) {
      await this.transitionTo(
        "QA",
        "Sem direcao criativa, pulando geracao de imagem"
      );
      return;
    }

    // TODO: Replace with actual image generation call (Ideogram/DALL-E/etc.)
    // When implemented:
    //   const imageUrl = await generateImage(creative.image_prompt);
    //   await this.supabase.from("deliverables").insert({
    //     request_id: this.requestId,
    //     deliverable_type: "generated_image",
    //     title: "Imagem gerada por IA",
    //     content_text: imageUrl,
    //     content_json: { image_prompt: creative.image_prompt, image_url: imageUrl } as unknown as Json,
    //   });
    //   await this.transitionTo("VALIDATION", "Imagem gerada com sucesso");

    await this.logEvent(
      "image_gen_skipped",
      "Geracao de imagem ainda nao implementada -- seguindo para QA",
      { image_prompt: creative.image_prompt }
    );

    // Skip to QA until image generation is implemented
    await this.transitionTo(
      "QA",
      "Image generation nao implementada, pulando para QA"
    );
  }

  private async handleValidation(): Promise<void> {
    // Get the latest generated image
    const { data: imageDeliverable } = await this.supabase
      .from("deliverables")
      .select("content_json, content_text")
      .eq("request_id", this.requestId)
      .eq("deliverable_type", "generated_image")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!imageDeliverable) {
      await this.transitionTo(
        "QA",
        "Nenhuma imagem encontrada para validacao, seguindo para QA"
      );
      return;
    }

    const imageUrl = imageDeliverable.content_text ?? "";
    const creative = await this.getLatestCreative();
    const briefing = await this.getLatestBriefing();

    try {
      const validationService = new ImageValidationService();
      // Build expected text from copy deliverable
      const copyData = await this.getLatestCopy();
      const expectedText: Record<string, string> = {};
      if (copyData?.copy?.headline_1) expectedText.headline = copyData.copy.headline_1;
      if (copyData?.copy?.cta_primary) expectedText.cta = copyData.copy.cta_primary;
      if (briefing?.offer) expectedText.price = briefing.offer;

      const validationResult = await validationService.validateImageText(
        this.requestId,
        imageUrl,
        expectedText
      );

      const score = validationResult.score ?? 0;

      await this.logEvent(
        "image_validation",
        `Score: ${score}/100`,
        validationResult
      );

      if (score >= 90) {
        await this.transitionTo(
          "QA",
          `Imagem aprovada com score ${score}/100`
        );
      } else if (score >= 70 && this.imageRetries < 2) {
        this.imageRetries++;
        await this.transitionTo(
          "CORRECTION",
          `Score ${score}/100 -- correcao ${this.imageRetries}/2`
        );
      } else {
        await this.transitionTo(
          "FALLBACK",
          `Score ${score}/100, retries ${this.imageRetries}/2 -- usando fallback`
        );
      }
    } catch (error) {
      await this.logEvent(
        "image_validation_error",
        `Erro na validacao: ${String(error)}`
      );
      await this.transitionTo(
        "QA",
        "Erro na validacao de imagem, seguindo para QA"
      );
    }
  }

  private async handleCorrection(): Promise<void> {
    await this.logEvent(
      "image_correction",
      `Tentativa de correcao ${this.imageRetries}/2`
    );

    // Re-run IMAGE_GEN which will re-generate and then go to VALIDATION
    await this.transitionTo(
      "IMAGE_GEN",
      `Re-gerando imagem (tentativa ${this.imageRetries}/2)`
    );
  }

  private async handleFallback(): Promise<void> {
    const creative = await this.getLatestCreative();
    const briefing = await this.getLatestBriefing();

    try {
      const fallbackGen = new FallbackGenerator();
      const copyData = await this.getLatestCopy();
      const expectedText: Record<string, string> = {};
      if (copyData?.copy?.headline_1) expectedText.headline = copyData.copy.headline_1;
      if (copyData?.copy?.cta_primary) expectedText.cta = copyData.copy.cta_primary;
      if (briefing?.offer) expectedText.price = briefing.offer;
      if (copyData?.copy?.body) expectedText.body = copyData.copy.body;

      const brandData = this.businessRules?.brandRules as Record<string, unknown> | null;
      const palette = (brandData?.color_palette ?? {}) as Record<string, string>;
      const colors = {
        primary: palette.primary || "#1a2e4a",
        secondary: palette.secondary || "#ffffff",
        accent: palette.accent || "#f5a623",
      };
      const format = (briefing?.format || "1080x1080") as "1080x1080" | "1080x1920" | "1200x628";

      const svgString = await fallbackGen.generateFallbackImage(expectedText, colors, format);

      // Save fallback SVG as deliverable
      await this.supabase.from("deliverables").insert({
        request_id: this.requestId,
        deliverable_type: "generated_image",
        title: "Imagem fallback (SVG deterministico)",
        content_text: svgString,
        content_json: {
          type: "svg_fallback",
          is_fallback: true,
        } as unknown as Json,
      });

      await this.logEvent(
        "fallback_generated",
        "SVG fallback gerado com sucesso"
      );
    } catch (error) {
      await this.logEvent(
        "fallback_error",
        `Erro no fallback: ${String(error)}`
      );
      // Continue to DELIVERY even if fallback fails
    }

    await this.transitionTo(
      "DELIVERY",
      "Fallback concluido, seguindo para entrega"
    );
  }

  private async handleQA(): Promise<void> {
    const briefing = await this.getLatestBriefing();
    const copy = await this.getLatestCopy();
    const creative = await this.getLatestCreative();

    if (!briefing || !copy) {
      throw new Error("Briefing or copy not found for QA");
    }

    const runId = await this.saveAgentRun(
      "qa",
      { briefing, copy, creative, businessRules: this.businessRules },
      "claude-sonnet-4-6-20250514"
    );

    const qaResult = await runQAAgent(briefing, copy, creative);
    await this.completeAgentRun(runId, qaResult);

    if (!qaResult.success || !qaResult.output) {
      await this.failAgentRun(
        runId,
        qaResult.error ?? "Unknown QA error"
      );
      throw new Error(
        `QA failed: ${qaResult.error ?? "Unknown error"}`
      );
    }

    const qa = qaResult.output;

    // Load current revision count from DB
    const { data: freshRequest } = await this.supabase
      .from("requests")
      .select("revision_count")
      .eq("id", this.requestId)
      .single();
    const dbRevisionCount = freshRequest?.revision_count ?? 0;

    if (qa.score >= 7) {
      // QA passed -- proceed to delivery
      await this.logEvent(
        "qa_approved",
        `Score: ${qa.score}/10 -- Aprovado`,
        qa
      );
      await this.transitionTo(
        "DELIVERY",
        `QA aprovado com score ${qa.score}/10`
      );
    } else if (dbRevisionCount < 2) {
      // QA failed but can retry
      this.qaRetries = dbRevisionCount + 1;
      await this.supabase
        .from("requests")
        .update({ revision_count: this.qaRetries })
        .eq("id", this.requestId);

      await this.logEvent(
        "qa_revision_needed",
        `Score: ${qa.score}/10. Revisao ${this.qaRetries}/2. Feedback: ${qa.feedback}`,
        qa
      );

      // Go back to STRATEGY_COPY with QA feedback
      await this.transitionTo(
        "STRATEGY_COPY",
        `QA reprovado (${qa.score}/10), revisao ${this.qaRetries}/2`
      );
    } else {
      // Max retries exhausted -- deliver with human review flag
      await this.logEvent(
        "qa_max_retries",
        `Score: ${qa.score}/10. Maximo de revisoes atingido. Revisao humana necessaria.`,
        qa
      );
      await this.supabase
        .from("requests")
        .update({ needs_human_review: true })
        .eq("id", this.requestId);

      await this.transitionTo(
        "DELIVERY",
        "Retries esgotados, entrega com revisao humana"
      );
    }
  }

  private async handleDelivery(): Promise<void> {
    const briefing = await this.getLatestBriefing();
    const copy = await this.getLatestCopy();
    const creative = await this.getLatestCreative();

    if (!briefing || !copy) {
      throw new Error("Briefing or copy not found for delivery");
    }

    // Check for generated/fallback image URL
    const { data: imageDeliverable } = await this.supabase
      .from("deliverables")
      .select("content_text")
      .eq("request_id", this.requestId)
      .in("deliverable_type", ["generated_image", "fallback_image"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const imageUrl = imageDeliverable?.content_text ?? null;

    // Get the latest QA output
    const { data: qaRun } = await this.supabase
      .from("agent_runs")
      .select("output_payload")
      .eq("request_id", this.requestId)
      .eq("agent_name", "qa")
      .eq("run_status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const qa: QAOutput = (qaRun?.output_payload as unknown as QAOutput) ?? {
      score: 0,
      passed: false,
      issues: [],
      feedback: "QA nao executado",
      recommendation: "human_review" as const,
    };

    // Check needs_human_review flag
    const { data: reqCheck } = await this.supabase
      .from("requests")
      .select("needs_human_review")
      .eq("id", this.requestId)
      .single();
    const needsHumanReview = reqCheck?.needs_human_review ?? false;

    await this.saveFullDelivery(
      briefing,
      copy,
      creative,
      qa,
      imageUrl,
      needsHumanReview
    );

    await this.transitionTo("COMPLETED", "Entrega finalizada");
  }

  // ── Main execution loop ─────────────────

  async run(): Promise<void> {
    // Load request data
    const { data: request, error: fetchError } = await this.supabase
      .from("requests")
      .select("*")
      .eq("id", this.requestId)
      .single();

    if (fetchError || !request) {
      throw new Error(`Request not found: ${this.requestId}`);
    }

    this.request = request as Record<string, unknown>;
    this.qaRetries =
      ((request as Record<string, unknown>).revision_count as number) ?? 0;

    // Load business rules context (non-fatal if tables do not exist)
    try {
      await this.loadBusinessRules();
    } catch {
      await this.logEvent(
        "business_rules_warning",
        "Nao foi possivel carregar regras de negocio"
      );
    }

    await this.logEvent(
      "orchestrator_started",
      `Processando a partir do estado: ${this.state}`
    );

    const terminalStates: WorkflowState[] = [
      "AWAITING_ANSWERS",
      "COMPLETED",
      "FAILED",
    ];

    while (!terminalStates.includes(this.state)) {
      try {
        switch (this.state) {
          case "INTAKE":
            await this.handleIntake();
            break;
          case "BRIEFING":
            await this.handleBriefing();
            break;
          case "STRATEGY_COPY":
            await this.handleStrategyCopy();
            break;
          case "CREATIVE":
            await this.handleCreative();
            break;
          case "IMAGE_GEN":
            await this.handleImageGen();
            break;
          case "VALIDATION":
            await this.handleValidation();
            break;
          case "CORRECTION":
            await this.handleCorrection();
            break;
          case "QA":
            await this.handleQA();
            break;
          case "FALLBACK":
            await this.handleFallback();
            break;
          case "DELIVERY":
            await this.handleDelivery();
            break;
          default:
            await this.logEvent(
              "unknown_state",
              `Estado desconhecido: ${this.state}`
            );
            this.state = "FAILED";
            break;
        }
      } catch (error) {
        const errorMsg = String(error);
        await this.logEvent(
          "step_error",
          `Erro no estado ${this.state}: ${errorMsg}`
        );

        // Save last_completed_step for recovery
        await this.supabase
          .from("requests")
          .update({
            last_completed_step: this.state.toLowerCase(),
            status: STATE_TO_DB_STATUS["FAILED"],
          })
          .eq("id", this.requestId);

        await this.untypedDb.from("request_state_history").insert({
          request_id: this.requestId,
          from_state: this.state,
          to_state: "FAILED",
          reason: errorMsg,
        });

        this.state = "FAILED";
      }
    }

    await this.logEvent(
      "orchestrator_finished",
      `Finalizado no estado: ${this.state}`
    );
  }
}

// ── Public API ──────────────────────────────

/** Step name to next FSM state mapping for resumption */
const STEP_TO_NEXT_STATE: Record<string, WorkflowState> = {
  intake: "BRIEFING",
  briefing: "STRATEGY_COPY",
  strategy_copy: "CREATIVE",
  creative: "IMAGE_GEN",
  image_gen: "VALIDATION",
  validation: "QA",
  qa: "DELIVERY",
  delivery: "COMPLETED",
};

/**
 * Process a request through the multi-agent FSM pipeline.
 *
 * @param requestId - The request UUID
 * @param resumeFrom - Optional FSM state to resume from (skips prior states).
 *                     Accepts a WorkflowState (e.g. "STRATEGY_COPY") or a
 *                     DB last_completed_step (e.g. "briefing").
 */
export async function processRequest(
  requestId: string,
  resumeFrom?: string
): Promise<void> {
  let startState: WorkflowState = "INTAKE";

  if (resumeFrom) {
    // Check if it is already a valid WorkflowState
    const upperResume = resumeFrom.toUpperCase() as WorkflowState;
    if (STATE_ORDER.includes(upperResume)) {
      startState = upperResume;
    } else {
      // Try mapping from DB status
      const mapped = DB_STATUS_TO_STATE[resumeFrom];
      if (mapped) {
        startState = mapped;
      }
    }
  } else {
    // Auto-detect from DB state
    const supabase = createAdminClient();
    const { data: request } = await supabase
      .from("requests")
      .select("status, last_completed_step")
      .eq("id", requestId)
      .single();

    if (request) {
      const dbStatus = request.status as string;
      const lastStep = request.last_completed_step as string | null;

      // If there is a last_completed_step, resume from the NEXT state
      if (lastStep) {
        const upperStep = lastStep.toUpperCase() as WorkflowState;
        if (STATE_ORDER.includes(upperStep)) {
          const idx = STATE_ORDER.indexOf(upperStep);
          if (idx < STATE_ORDER.length - 1) {
            startState = STATE_ORDER[idx + 1];
          }
        } else {
          startState =
            STEP_TO_NEXT_STATE[lastStep] ??
            DB_STATUS_TO_STATE[dbStatus] ??
            "INTAKE";
        }
      } else {
        startState = DB_STATUS_TO_STATE[dbStatus] ?? "INTAKE";
      }
    }
  }

  const orchestrator = new WorkflowOrchestrator(requestId, startState);
  await orchestrator.run();
}

/** Alias for backward compatibility with API routes */
export const runOrchestrator = processRequest;
