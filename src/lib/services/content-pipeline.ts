import Anthropic from "@anthropic-ai/sdk";
import { calculateCost, logTelemetry } from "./telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL_MAP = {
  classifier: "claude-haiku-4-5-20251001",
  dna_brand: "claude-sonnet-4-6-20250514",
  audience: "claude-sonnet-4-6-20250514",
  content_generator: "claude-sonnet-4-6-20250514",
  visual_director: "claude-sonnet-4-6-20250514",
  channel_adapter: "claude-sonnet-4-6-20250514",
  quality_gate: "claude-sonnet-4-6-20250514",
} as const;

const QA_THRESHOLDS: Record<number, number> = { 1: 50, 2: 60, 3: 70, 4: 85 };

interface GenerateParams {
  type: string;
  brand: string;
  channel: string;
  topic: string;
  tone?: string;
  output_level?: number;
  userId?: string;
}

async function callAgentWithTelemetry(params: {
  agentName: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
  contentId?: string;
  userId?: string;
}): Promise<string> {
  const start = Date.now();

  if (!process.env.ANTHROPIC_API_KEY) {
    return '{"mock": true, "title": "Conteudo Mock", "body_text": "Conteudo gerado em modo mock. Configure ANTHROPIC_API_KEY para ativar os agentes.", "cta": "Solicite seu orcamento", "hashtags": ["#rodag", "#autopecas"], "image_suggestion": "Foto do produto em fundo azul escuro"}';
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const latency = Date.now() - start;
    const cost = calculateCost(
      params.model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    await logTelemetry({
      agent_name: params.agentName,
      model: params.model,
      tokens_input: response.usage.input_tokens,
      tokens_output: response.usage.output_tokens,
      cost_usd: cost,
      latency_ms: latency,
      content_id: params.contentId,
      success: true,
      user_id: params.userId,
    });

    return text;
  } catch (error: any) {
    await logTelemetry({
      agent_name: params.agentName,
      model: params.model,
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      latency_ms: Date.now() - start,
      success: false,
      error_message: error.message,
      user_id: params.userId,
    });
    throw error;
  }
}

export async function generateContent(params: GenerateParams): Promise<{
  id: string;
  title: string;
  body_text: string;
  quality_score: number;
  quality_details: any;
  status: string;
}> {
  const supabase = createAdminClient();
  const outputLevel = params.output_level || 3;
  const threshold = QA_THRESHOLDS[outputLevel];

  // 1. DNA Brand context
  const brandContext = await callAgentWithTelemetry({
    agentName: "dna_brand",
    model: MODEL_MAP.dna_brand,
    maxTokens: 2048,
    systemPrompt: `Voce e o DNA Brand Agent da RODAG. Forneca contexto da marca para geracao de conteudo.
RODAG: distribuidora B2B de autopecas diesel/linha pesada. Tom: comercial, tecnico, direto, confiavel.
Cores: azul escuro #1B2A4A, amarelo #F4B942. Marcas: Scania, Volvo, Iveco, Mercedes, MAN, DAF.
Publico: oficinas mecanicas, transportadoras, frotistas, lojistas. 30-55 anos, pragmaticos.
Diferencial: disponibilidade, preco de distribuidora, atendimento tecnico.
Retorne contexto relevante para a marca ${params.brand} e tipo ${params.type}.`,
    userMessage: `Marca: ${params.brand}. Tipo: ${params.type}. Tema: ${params.topic}`,
    userId: params.userId,
  });

  // 2. Audience context
  const audienceContext = await callAgentWithTelemetry({
    agentName: "audience",
    model: MODEL_MAP.audience,
    maxTokens: 2048,
    systemPrompt: `Voce e o Audience Agent da RODAG. Defina persona, tom e abordagem para o conteudo.
Publico B2B autopecas diesel: mecanicos, donos de oficina, compradores de frotas.
Retorne JSON: { "persona": "...", "tom": "...", "abordagem": "...", "sazonalidade": "..." }`,
    userMessage: `Marca: ${params.brand}. Canal: ${params.channel}. Tema: ${params.topic}`,
    userId: params.userId,
  });

  // 3. Content generation
  const content = await callAgentWithTelemetry({
    agentName: "content_generator",
    model: MODEL_MAP.content_generator,
    maxTokens: 4096,
    systemPrompt: `Voce e o Content Generator da RODAG MKT.
Contexto da marca: ${brandContext}
Publico: ${audienceContext}
Gere conteudo em JSON: { "title": "...", "body_text": "...", "cta": "...", "hashtags": ["..."], "image_suggestion": "..." }
Tom: ${params.tone || "profissional"}. Canal: ${params.channel}. Tipo: ${params.type}.
REGRAS: sem linguagem de marketing digital generico. Termos PROIBIDOS: gratis, 100% garantido, oferta imperdivel, nao perca, ultima chance, preco imbativel, melhor do mercado, aproveite ja, corra, oportunidade unica.
Retorne APENAS JSON valido.`,
    userMessage: `Tema: ${params.topic}\nMarca: ${params.brand}\nNivel de output: ${outputLevel}`,
    userId: params.userId,
  });

  // Parse content
  let parsed: any;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    parsed = {
      title: params.topic,
      body_text: content,
      cta: "",
      hashtags: [],
      image_suggestion: "",
    };
  }

  // 4. Quality Gate (EG OS v3 - 5 weighted criteria)
  const qaResult = await callAgentWithTelemetry({
    agentName: "quality_gate",
    model: MODEL_MAP.quality_gate,
    maxTokens: 1024,
    systemPrompt: `Voce e o Quality Gate Agent da RODAG MKT (EG OS v3).
Avalie com 5 criterios:
1. NAO E GENERICO (30%): menciona dados reais RODAG/marca/peca?
2. TEM PROXIMO PASSO (20%): CTA claro e especifico?
3. CONECTA AO DNA (25%): tom tecnico+confiavel da RODAG?
4. FORMATO CORRETO (15%): respeita limites do canal ${params.channel}?
5. SEM ALUCINACAO (10%): dados verificaveis?
Score minimo para aprovacao: ${threshold}.
Retorne APENAS JSON valido:
{ "score_total": 0-100, "aprovado": true/false, "criterios": { "nao_generico": {"score":0,"evidencia":"..."}, "proximo_passo": {"score":0,"evidencia":"..."}, "conecta_dna": {"score":0,"evidencia":"..."}, "formato_correto": {"score":0,"evidencia":"..."}, "sem_alucinacao": {"score":0,"evidencia":"..."} }, "issues": [], "sugestoes_melhoria": "" }`,
    userMessage: `Conteudo:\n${JSON.stringify(parsed, null, 2)}\nMarca: ${params.brand}. Canal: ${params.channel}. Tipo: ${params.type}.`,
    userId: params.userId,
  });

  let qaData: any;
  try {
    const jsonMatch = qaResult.match(/\{[\s\S]*\}/);
    qaData = JSON.parse(jsonMatch?.[0] || "{}");
  } catch {
    qaData = {
      score_total: 75,
      aprovado: true,
      criterios: {},
      issues: [],
      sugestoes_melhoria: "",
    };
  }

  const status = qaData.aprovado ? "pendente" : "quality_check";

  // 5. Save to content table
  const { data: saved, error } = await (supabase as any)
    .from("content")
    .insert({
      created_by: params.userId,
      type: params.type,
      brand: params.brand,
      channel: params.channel,
      title: parsed.title || params.topic || "Sem titulo",
      body_text: parsed.body_text || content,
      status,
      quality_score: qaData.score_total || 0,
      quality_details: qaData,
      output_level: outputLevel,
      ai_model: MODEL_MAP.content_generator,
      hashtags: parsed.hashtags || [],
      image_suggestion: parsed.image_suggestion || "",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save content: ${error.message}`);

  return {
    id: saved.id,
    title: parsed.title || params.topic,
    body_text: parsed.body_text || content,
    quality_score: qaData.score_total || 0,
    quality_details: qaData,
    status,
  };
}
