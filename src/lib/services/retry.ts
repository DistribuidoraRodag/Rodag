export async function executeWithRetry<T>(
  generateFn: (model: string, extraContext: string) => Promise<T>,
  qaFn: (
    content: T
  ) => Promise<{ score_total: number; aprovado: boolean }>,
  dnaFull: string
): Promise<{
  content: T;
  qa: { score_total: number; aprovado: boolean };
  attempts: number;
  model_used: string;
}> {
  // Attempt 1: Sonnet standard
  let content = await generateFn("claude-sonnet-4-6-20250514", "");
  let qa = await qaFn(content);
  if (qa.aprovado) {
    return {
      content,
      qa,
      attempts: 1,
      model_used: "claude-sonnet-4-6-20250514",
    };
  }

  // Attempt 2: Sonnet + full DNA context
  content = await generateFn("claude-sonnet-4-6-20250514", dnaFull);
  qa = await qaFn(content);
  if (qa.aprovado) {
    return {
      content,
      qa,
      attempts: 2,
      model_used: "claude-sonnet-4-6-20250514",
    };
  }

  // Attempt 3: Opus + full context (escalation)
  content = await generateFn("claude-opus-4-6", dnaFull);
  qa = await qaFn(content);
  return { content, qa, attempts: 3, model_used: "claude-opus-4-6" };
}
