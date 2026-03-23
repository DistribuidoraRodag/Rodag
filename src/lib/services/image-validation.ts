import Anthropic from "@anthropic-ai/sdk";
import { createUntypedAdminClient } from "@/lib/supabase/admin-untyped";

export class ImageValidationService {
  private supabase = createUntypedAdminClient();

  async validateImageText(
    requestId: string,
    imageUrl: string,
    expectedText: Record<string, string>
  ): Promise<{
    score: number;
    detectedText: Record<string, string>;
    needsCorrection: boolean;
  }> {
    // Mock mode
    if (!process.env.ANTHROPIC_API_KEY) {
      const result = {
        score: 95,
        detectedText: { ...expectedText },
        needsCorrection: false,
      };
      await this.saveValidation(requestId, expectedText, result.detectedText, result.score, false);
      return result;
    }

    const detectedText = await this.extractTextWithVision(imageUrl, expectedText);
    const score = this.calculateSimilarityScore(expectedText, detectedText);
    const needsCorrection = score < 90;

    await this.saveValidation(requestId, expectedText, detectedText, score, needsCorrection);

    return { score, detectedText, needsCorrection };
  }

  private async extractTextWithVision(
    imageUrl: string,
    expectedText: Record<string, string>
  ): Promise<Record<string, string>> {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const fields = Object.keys(expectedText).join(", ");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: `Extraia EXATAMENTE os seguintes textos desta imagem de marketing: ${fields}

Textos esperados para referência:
${JSON.stringify(expectedText, null, 2)}

Retorne APENAS um JSON com os textos que você consegue ler na imagem. Se um campo não for encontrado ou estiver ilegível, retorne null para ele.

Exemplo de resposta:
${JSON.stringify(
  Object.fromEntries(
    Object.keys(expectedText).map((k) => [k, expectedText[k] || null])
  ),
  null,
  2
)}`,
            },
          ],
        },
      ],
    });

    try {
      const text = response.content[0].type === "text" ? response.content[0].text : "{}";
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }

  private calculateSimilarityScore(
    expected: Record<string, string>,
    detected: Record<string, string>
  ): number {
    const keys = Object.keys(expected);
    if (keys.length === 0) return 100;

    let totalScore = 0;

    for (const key of keys) {
      const expectedVal = (expected[key] || "").trim().toLowerCase();
      const detectedVal = (detected[key] || "").trim().toLowerCase();

      if (!detectedVal) {
        totalScore += 0;
      } else {
        totalScore += this.stringSimilarity(expectedVal, detectedVal);
      }
    }

    return Math.round((totalScore / keys.length) * 100);
  }

  private stringSimilarity(a: string, b: string): number {
    const longer = a.length >= b.length ? a : b;
    const shorter = a.length >= b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private async saveValidation(
    requestId: string,
    expectedText: Record<string, string>,
    detectedText: Record<string, string>,
    score: number,
    needsCorrection: boolean
  ): Promise<void> {
    await this.supabase.from("image_validations").insert({
      request_id: requestId,
      expected_text: expectedText,
      detected_text: detectedText,
      similarity_score: score,
      needs_correction: needsCorrection,
    });
  }
}
