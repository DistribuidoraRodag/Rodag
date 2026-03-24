import Anthropic from "@anthropic-ai/sdk";

export interface ClassificationResult {
  tier: "T0" | "T1" | "T2" | "T3";
  braco: string;
  agente: string;
  modelo: "haiku" | "sonnet" | "opus";
  contexto_minimo: string[];
}

export async function classifyIntent(
  message: string,
  userRole: string
): Promise<ClassificationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      tier: "T3",
      braco: "marketing",
      agente: "content_generator",
      modelo: "sonnet",
      contexto_minimo: ["dna"],
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `Voce e o Classificador de Intent do sistema RODAG MKT.
Analise a solicitacao e retorne JSON com: tier (T0-T3), braco, agente, modelo (haiku/sonnet/opus), contexto_minimo (array).
Agentes: orchestrator, dna_brand, audience, content_generator, visual_director, channel_adapter, quality_gate, approval_agent, calendar_agent, sales_library, analytics_agent.
Regras:
- gerar/criar conteudo/post → content_generator (T3, sonnet)
- aprovar/rejeitar → approval_agent (T2, sonnet)
- calendario/agendar → calendar_agent (T3, sonnet)
- compartilhar/biblioteca/vendas → sales_library (T3, sonnet)
- analytics/metricas/relatorio → analytics_agent (T3, sonnet)
- estrategia de conteudo/planejamento → content_generator (T2, opus)
Retorne APENAS JSON valido.`,
      messages: [
        {
          role: "user",
          content: `Role: ${userRole}\nSolicitacao: ${message}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    return {
      tier: "T3",
      braco: "marketing",
      agente: "content_generator",
      modelo: "sonnet",
      contexto_minimo: ["dna"],
    };
  }
}
