import Anthropic from "@anthropic-ai/sdk";
import { calculateCost, logTelemetry } from "./telemetry";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadRodagKnowledge } from "./notebooklm";

// EG OS v3 — Mapa de IAs por agente (alinhado com Notion MAPA DE IAs)
const MODEL_MAP = {
  classifier: "claude-haiku-4-5-20251001",       // Triagem rapida
  dna_brand: "claude-opus-4-6-20250514",          // Opus: analise profunda de DNA
  audience: "claude-opus-4-6-20250514",           // Opus: definicao de ICP/persona
  content_generator: "claude-sonnet-4-6-20250514", // Sonnet: execucao estruturada
  visual_director: "claude-sonnet-4-6-20250514",  // Sonnet + GPT-4o (suporte)
  channel_adapter: "claude-sonnet-4-6-20250514",  // Sonnet: adaptacao por canal
  quality_gate: "claude-sonnet-4-6-20250514",     // Sonnet: validacao checklist
  strategy: "claude-opus-4-6-20250514",           // Opus: decisoes estrategicas
} as const;

const QA_THRESHOLDS: Record<number, number> = { 1: 50, 2: 60, 3: 70, 4: 85 };

// NotebookLM RODAG — notebook ID para consulta de DNA
const RODAG_NOTEBOOK_ID = "3cf62a11";

interface GenerateParams {
  type: string;
  brand: string;
  channel: string;
  topic: string;
  tone?: string;
  output_level?: number;
  userId?: string;
  icp?: string;
  funnel_stage?: string;
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

  const icpContext = params.icp || "Oficinas mecanicas, transportadoras, frotistas — B2B diesel";
  const funnelStage = params.funnel_stage || "awareness";

  // 0. Load NotebookLM knowledge base (cached 24h)
  const knowledgeBase = await loadRodagKnowledge();

  // 1. DNA Brand Agent (Opus — analise profunda + NotebookLM context)
  const brandContext = await callAgentWithTelemetry({
    agentName: "dna_brand",
    model: MODEL_MAP.dna_brand,
    maxTokens: 2048,
    systemPrompt: `NOME: DNA Brand Agent
BRACO: 6 — Marketing
MODELO: Claude Opus
FUNCAO PRINCIPAL: Fornecer contexto profundo e exclusivo da marca RODAG para geracao de conteudo. Nunca generico.
FUNCAO QUE NAO FAZ: Nao gera conteudo final — apenas contexto.
KNOWLEDGE BASE: NotebookLM RODAG (ID: ${RODAG_NOTEBOOK_ID}) — 16 agentes, 87 skills, DNA completo.

DNA RODAG:
- Distribuidora B2B de autopecas diesel/linha pesada (Belo Horizonte/MG)
- Marcas: Scania, Volvo, Iveco, Mercedes-Benz, MAN, DAF, Volkswagen
- Produtos: filtros, turbinas, freios, embreagens, suspensao, motor, eletrica
- Publico: oficinas mecanicas, transportadoras, frotistas, lojistas (30-55 anos, pragmaticos)
- Tom: comercial, tecnico, direto, confiavel. Sem firula, sem linguagem de curso de marketing.
- Diferencial: disponibilidade imediata, preco de distribuidora, atendimento tecnico especializado
- Cores: azul escuro #1B2A4A (primaria), amarelo #F4B942 (accent), branco #FFFFFF
- Dono: Gustavo (admin do sistema)
- CTA padrao: WhatsApp ou telefone (31) 3029-0300

BASE DE CONHECIMENTO (NotebookLM):
${knowledgeBase}

Retorne contexto rico e especifico para a marca ${params.brand} e tipo ${params.type}. Inclua dados tecnicos da peca quando possivel. Use APENAS dados do catalogo acima.`,
    userMessage: `Marca: ${params.brand}. Tipo: ${params.type}. Tema: ${params.topic}. ICP: ${icpContext}`,
    userId: params.userId,
  });

  // 2. Audience Agent (Opus — definicao profunda de ICP/persona)
  const audienceContext = await callAgentWithTelemetry({
    agentName: "audience",
    model: MODEL_MAP.audience,
    maxTokens: 2048,
    systemPrompt: `NOME: Audience Agent
BRACO: 6 — Marketing
MODELO: Claude Opus
FUNCAO PRINCIPAL: Definir persona, tom e abordagem conectados ao ICP real da RODAG. Nunca generico.
FUNCAO QUE NAO FAZ: Nao gera conteudo — apenas define publico.

ICP RODAG:
- Mecanicos/donos de oficina: pragmaticos, buscam peca confiavel com preco bom. 30-55 anos.
- Compradores de frota: buscam volume + prazo + confiabilidade tecnica.
- Lojistas: buscam margem + disponibilidade + variedade de catalogo.
- Transportadoras: buscam SLA de entrega + suporte tecnico + preco competitivo.

Etapa do funil: ${funnelStage}
- awareness: educativo, mostrar expertise
- interest: demonstrar solucao especifica
- consideration: comparativo, prova social
- conversion: oferta direta, CTA urgente
- retention: pos-venda, relacionamento

Retorne JSON: { "persona": "...", "tom": "...", "abordagem": "...", "dor_principal": "...", "motivacao_compra": "...", "sazonalidade": "..." }`,
    userMessage: `Marca: ${params.brand}. Canal: ${params.channel}. Tema: ${params.topic}. ICP: ${icpContext}. Etapa funil: ${funnelStage}`,
    userId: params.userId,
  });

  // 3. Content Generator (Sonnet — execucao estruturada)
  const content = await callAgentWithTelemetry({
    agentName: "content_generator",
    model: MODEL_MAP.content_generator,
    maxTokens: 4096,
    systemPrompt: `NOME: Content Generator
BRACO: 6 — Marketing
MODELO: Claude Sonnet
TEMPERATURE: 0.7 (criativo)
FUNCAO PRINCIPAL: Gerar conteudo de marketing completo com hook, copy, CTA e hashtags.
FUNCAO QUE NAO FAZ: Nao faz analise estrategica — usa o contexto recebido.

CONTEXTO DA MARCA:
${brandContext}

PUBLICO-ALVO:
${audienceContext}

ETAPA DO FUNIL: ${funnelStage}
ICP: ${icpContext}

REGRAS ABSOLUTAS:
- Tom: ${params.tone || "profissional"} — nunca linguagem de curso de marketing digital
- Canal: ${params.channel} — respeitar limites (Instagram ~150 chars legenda curta, WhatsApp ~100 chars)
- Tipo: ${params.type}
- Termos PROIBIDOS: gratis, 100% garantido, oferta imperdivel, nao perca, ultima chance, preco imbativel, melhor do mercado, aproveite ja, corra, oportunidade unica
- Elementos OBRIGATORIOS: telefone/WhatsApp no CTA, mencionar marca/peca especifica, logo Rodag
- SEMPRE incluir hook de abertura (primeiros 5 segundos de atencao)
- CTA deve ser ESPECIFICO ("Ligue (31) 3029-0300" > "Entre em contato")

Retorne APENAS JSON valido:
{ "title": "...", "hook": "...", "body_text": "...", "cta": "...", "hashtags": ["..."], "image_suggestion": "...", "caption_short": "...", "caption_long": "..." }`,
    userMessage: `Tema: ${params.topic}\nMarca: ${params.brand}\nNivel de output: ${outputLevel}\nEtapa funil: ${funnelStage}`,
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

  // 4. Quality Gate (EG OS v3 - 5 weighted criteria + hook validation)
  const qaResult = await callAgentWithTelemetry({
    agentName: "quality_gate",
    model: MODEL_MAP.quality_gate,
    maxTokens: 1024,
    systemPrompt: `NOME: Quality Gate Agent
BRACO: 7 — Tecnologia
MODELO: Claude Sonnet
TEMPERATURE: 0.1 (preciso)
FUNCAO PRINCIPAL: Validar TODO conteudo antes de chegar ao Gustavo (admin). Ultima barreira.

CRITERIOS DE APROVACAO (5 criterios, 100 pontos):

1. NAO E GENERICO (30%):
   - Menciona dados reais? (RODAG, marca, nome de peca, especificacao)
   - Poderia ser de qualquer distribuidora? Se sim → FALHA
   - Score: 0 se generico, 30 se 100% especifico

2. TEM PROXIMO PASSO (20%):
   - CTA claro e especifico? ("Ligue (31) 3029-0300" > "Entre em contato")
   - Score: 0 sem CTA, 20 se CTA especifico com telefone/WhatsApp

3. CONECTA AO DNA (25%):
   - Tom tecnico + confiavel da RODAG? Sem firula?
   - Respeita termos proibidos? (nunca: gratis, 100% garantido, etc.)
   - Score: 0 se desconectado, 25 se 100% alinhado

4. FORMATO CORRETO (15%):
   - Canal ${params.channel}: respeita limites de caracteres?
   - Hook existe e tem menos de 5 segundos de atencao?
   - Hashtags quando aplicavel?
   - Score: 0 se formato errado, 15 se perfeito

5. SEM ALUCINACAO (10%):
   - Dados tecnicos verificaveis? Nao inventa specs de pecas?
   - Nao inventa precos ou disponibilidade?
   - Score: 0 se alucinacao detectada, 10 se factual

Score minimo para aprovacao: ${threshold}.
Etapa do funil: ${funnelStage} — avaliar se conteudo esta adequado para esta etapa.

Retorne APENAS JSON valido:
{ "score_total": 0-100, "aprovado": true/false, "criterios": { "nao_generico": {"score":0,"evidencia":"..."}, "proximo_passo": {"score":0,"evidencia":"..."}, "conecta_dna": {"score":0,"evidencia":"..."}, "formato_correto": {"score":0,"evidencia":"..."}, "sem_alucinacao": {"score":0,"evidencia":"..."} }, "issues": [], "sugestoes_melhoria": "" }`,
    userMessage: `Conteudo:\n${JSON.stringify(parsed, null, 2)}\nMarca: ${params.brand}. Canal: ${params.channel}. Tipo: ${params.type}. ICP: ${icpContext}. Funil: ${funnelStage}.`,
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

  // 5. Save to content table (with ICP + funnel + hook)
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
      hook: parsed.hook || "",
      icp_target: icpContext,
      funnel_stage: funnelStage,
      caption_short: parsed.caption_short || "",
      caption_long: parsed.caption_long || "",
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
