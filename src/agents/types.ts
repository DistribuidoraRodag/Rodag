export interface IntakeResult {
  request_type: string | null;
  marketing_goal: string | null;
  product_line: string | null;
  target_audience: string | null;
  mandatory_info: {
    price: string | null;
    cta: string | null;
    brand: string | null;
  };
  confidence: number;
  missing_fields: string[];
  questions: string[];
  needs_followup: boolean;
}

export interface BriefingResult {
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

export interface StrategyCopyResult {
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

export interface CreativeResult {
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

export interface QAResult {
  score: number;
  approved: boolean;
  checklist: {
    objective_met: boolean;
    audience_correct: boolean;
    cta_present: boolean;
    mandatory_info_included: boolean;
    tone_adequate: boolean;
    copy_visual_aligned: boolean;
  };
  issues: string[];
  feedback: string;
}

export const VISUAL_PIECE_TYPES = [
  "instagram_post",
  "story",
  "banner",
  "anuncio",
  "carrossel",
  "catalogo",
];

export function isVisualPiece(pieceType: string): boolean {
  return VISUAL_PIECE_TYPES.some((t) =>
    pieceType.toLowerCase().includes(t)
  );
}
