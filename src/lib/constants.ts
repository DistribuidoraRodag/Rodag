export const STATUS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  novo_pedido: { label: "Novo Pedido", color: "text-blue-300", bgColor: "bg-blue-500/20 border-blue-500/30" },
  aguardando_complemento: { label: "Aguardando Info", color: "text-yellow-300", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  briefing_em_montagem: { label: "Montando Briefing", color: "text-purple-300", bgColor: "bg-purple-500/20 border-purple-500/30" },
  briefing_fechado: { label: "Briefing Fechado", color: "text-indigo-300", bgColor: "bg-indigo-500/20 border-indigo-500/30" },
  em_processamento_multiagente: { label: "Agentes em Produção", color: "text-orange-300", bgColor: "bg-orange-500/20 border-orange-500/30" },
  copy_pronta: { label: "Copy Pronta", color: "text-teal-300", bgColor: "bg-teal-500/20 border-teal-500/30" },
  direcao_criativa_pronta: { label: "Criativo Pronto", color: "text-cyan-300", bgColor: "bg-cyan-500/20 border-cyan-500/30" },
  imagem_gerada: { label: "Imagem Gerada", color: "text-sky-300", bgColor: "bg-sky-500/20 border-sky-500/30" },
  imagem_validada: { label: "Imagem Validada", color: "text-lime-300", bgColor: "bg-lime-500/20 border-lime-500/30" },
  imagem_corrigida: { label: "Imagem Corrigida", color: "text-emerald-300", bgColor: "bg-emerald-500/20 border-emerald-500/30" },
  entrega_em_validacao: { label: "Validando Qualidade", color: "text-amber-300", bgColor: "bg-amber-500/20 border-amber-500/30" },
  precisa_revisao: { label: "Em Revisão", color: "text-red-300", bgColor: "bg-red-500/20 border-red-500/30" },
  entrega_finalizada: { label: "Finalizado", color: "text-green-300", bgColor: "bg-green-500/20 border-green-500/30" },
  entregue_ao_cliente: { label: "Entregue", color: "text-emerald-300", bgColor: "bg-emerald-500/20 border-emerald-500/30" },
};

export const PROCESSING_STATUSES = [
  "briefing_em_montagem",
  "briefing_fechado",
  "em_processamento_multiagente",
  "copy_pronta",
  "direcao_criativa_pronta",
  "imagem_gerada",
  "imagem_validada",
  "imagem_corrigida",
  "entrega_em_validacao",
  "precisa_revisao",
];

export const COMPLETED_STATUSES = ["entrega_finalizada", "entregue_ao_cliente"];

export const AGENT_PIPELINE = [
  { id: "intake", label: "Intake" },
  { id: "briefing", label: "Briefing" },
  { id: "strategy_copy", label: "Strategy + Copy" },
  { id: "creative", label: "Creative" },
  { id: "image", label: "Imagem" },
  { id: "qa", label: "QA + Entrega" },
] as const;

export function getActiveAgentIndex(status: string): number {
  switch (status) {
    case "briefing_em_montagem":
    case "briefing_fechado":
      return 1;
    case "em_processamento_multiagente":
    case "copy_pronta":
      return 2;
    case "direcao_criativa_pronta":
      return 3;
    case "imagem_gerada":
    case "imagem_validada":
    case "imagem_corrigida":
      return 4;
    case "entrega_em_validacao":
    case "precisa_revisao":
      return 5;
    case "entrega_finalizada":
    case "entregue_ao_cliente":
      return 6;
    default:
      return 0;
  }
}

export const REQUEST_EXAMPLES = [
  "Preciso de um post para Instagram vendendo filtro de óleo com foco em oficinas mecânicas",
  "Crie uma campanha para linha de turbo diesel com preço promocional",
  "Quero uma arte para WhatsApp sobre promoção de peças Scania",
  "Monte uma peça comercial para frotistas da linha pesada",
  "Preciso de um banner para anunciar peças de freio Mercedes com desconto",
];
