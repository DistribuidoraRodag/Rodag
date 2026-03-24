import { createAdminClient } from "@/lib/supabase/admin";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const prices = PRICING[model] || PRICING["claude-sonnet-4-6-20250514"];
  return (
    (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000
  );
}

export async function logTelemetry(data: {
  agent_name: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  latency_ms: number;
  content_id?: string;
  qa_score?: number;
  success: boolean;
  error_message?: string;
  user_id?: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await (supabase as any).from("usage_logs").insert({
      agent: data.agent_name,
      model: data.model,
      tokens_input: data.tokens_input,
      tokens_output: data.tokens_output,
      cost_usd: data.cost_usd,
      latency_ms: data.latency_ms,
      content_id: data.content_id,
      qa_score: data.qa_score,
      success: data.success,
      error_message: data.error_message,
      user_id: data.user_id,
    });
  } catch (e) {
    console.error("[Telemetry] Failed to log:", e);
  }
}
