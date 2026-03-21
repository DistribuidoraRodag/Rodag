// ============================================
// RODAG MKT SYSTEM — Agent I/O Types
// ============================================

export type AgentName =
  | "intake"
  | "briefing"
  | "strategy_copy"
  | "creative"
  | "image_generation"
  | "qa"
  | "delivery";

export type RequestStatus =
  | "novo_pedido"
  | "aguardando_complemento"
  | "briefing_em_montagem"
  | "briefing_fechado"
  | "em_processamento_multiagente"
  | "copy_pronta"
  | "direcao_criativa_pronta"
  | "imagem_gerada"
  | "imagem_validada"
  | "imagem_corrigida"
  | "entrega_em_validacao"
  | "precisa_revisao"
  | "entrega_finalizada"
  | "entregue_ao_cliente";

export interface IntakeOutput {
  request_type: string | null;
  marketing_goal: string | null;
  product_line: string | null;
  target_audience: string | null;
  known_fields: string[];
  missing_fields: string[];
  needs_followup_questions: boolean;
  questions: string[];
  confidence: number;
}

export interface BriefingOutput {
  summary: string;
  piece_type: string;
  format: string;
  goal: string;
  audience: string;
  audience_profile: string;
  product: string;
  offer: string;
  mandatory_elements: string[];
  tone: string;
  cta: string;
  restrictions: string[];
  brand_context: string;
}

export interface StrategyCopyOutput {
  strategy: {
    angle: string;
    value_prop: string;
    trigger: string;
    approach: string;
  };
  copy: {
    headline_1: string;
    headline_2: string;
    body: string;
    caption_short: string;
    caption_long: string;
    cta_primary: string;
    cta_secondary: string;
    cta_whatsapp: string;
  };
}

export interface CreativeOutput {
  visual_direction: {
    style: string;
    colors: string[];
    hierarchy: string[];
    mood: string;
  };
  layout: {
    format: string;
    top: string;
    center: string;
    bottom_left: string;
    bottom_right: string;
    corner: string;
  };
  image_prompt: string;
  designer_instruction: string;
}

export interface QAOutput {
  score: number;
  passed: boolean;
  issues: string[];
  feedback: string;
  recommendation: "approve" | "revise" | "human_review";
}

export interface DeliveryOutput {
  summary: string;
  pieces: {
    type: string;
    title: string;
    content: string;
  }[];
  next_steps: string[];
}

export interface AgentResult<T = unknown> {
  success: boolean;
  output: T | null;
  error?: string;
  tokens_used?: number;
  model_used?: string;
  cost_usd?: number;
}
