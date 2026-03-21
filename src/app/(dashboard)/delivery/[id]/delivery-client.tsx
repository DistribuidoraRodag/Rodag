"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Layers,
  MessageSquare,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";

type Request = Database["public"]["Tables"]["requests"]["Row"];
type Deliverable = Database["public"]["Tables"]["deliverables"]["Row"];

interface DeliveryContent {
  briefing: {
    summary: string;
    piece_type: string;
    format: string;
    goal: string;
    audience: string;
    product: string;
    offer: string;
    tone: string;
    cta: string;
  };
  strategyCopy: {
    strategy: { angle: string; value_prop: string; trigger: string; approach: string };
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
  };
  creative: {
    visual_direction: { style: string; colors: string[]; hierarchy: string[]; mood: string };
    layout: { format: string; top: string; center: string; bottom_left: string; bottom_right: string; corner: string };
    image_prompt: string;
    designer_instruction: string;
  } | null;
  qa: { score: number; approved: boolean; issues: string[]; feedback: string };
  imageUrl: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/50">{children}</div>}
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <CopyButton text={value} />
      </div>
      <p className="text-sm bg-muted/40 rounded-lg px-3 py-2 border border-border/50 leading-relaxed">{value}</p>
    </div>
  );
}

export function DeliveryClient({
  requestId,
  request,
  delivery,
}: {
  requestId: string;
  request: Request;
  delivery: Deliverable | null;
}) {
  const router = useRouter();

  if (!delivery?.content_json) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Entrega nao disponivel ainda.</p>
        <Button onClick={() => router.push(`/chat/${requestId}`)}>
          <MessageSquare className="w-4 h-4 mr-2" />
          Acompanhar no Chat
        </Button>
      </div>
    );
  }

  const content = delivery.content_json as unknown as DeliveryContent;
  const { briefing, strategyCopy, creative, qa } = content;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="container flex items-center gap-4 h-16">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{briefing.summary}</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">Entrega Concluida</span>
              {delivery.qa_score && (
                <span className="text-xs text-muted-foreground">Score QA: {delivery.qa_score}/10</span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/chat/${requestId}`)} className="gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </Button>
        </div>
      </header>

      <main className="container py-8 max-w-4xl mx-auto space-y-4">
        {/* QA Badge */}
        {qa && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${qa.approved ? "bg-emerald-500/10 border-emerald-500/20" : "bg-yellow-500/10 border-yellow-500/20"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${qa.approved ? "bg-emerald-500/20 text-emerald-300" : "bg-yellow-500/20 text-yellow-300"}`}>
              {qa.score}
            </div>
            <div>
              <p className={`font-semibold text-sm ${qa.approved ? "text-emerald-300" : "text-yellow-300"}`}>
                {qa.approved ? "Entrega aprovada pelo QA Agent" : "Entrega com pontos de atencao"}
              </p>
              <p className="text-xs text-muted-foreground">{qa.feedback}</p>
            </div>
          </div>
        )}

        {/* Generated Image */}
        {content.imageUrl && (
          <Section title="Imagem Gerada" icon={Layers}>
            <div className="pt-4">
              <img src={content.imageUrl} alt="Arte gerada" className="rounded-lg border border-border w-full max-w-lg mx-auto" />
            </div>
          </Section>
        )}

        {/* Briefing */}
        <Section title="Resumo do Briefing" icon={FileText}>
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Tipo de Peca", value: briefing.piece_type?.replace(/_/g, " ") },
              { label: "Formato", value: briefing.format },
              { label: "Objetivo", value: briefing.goal },
              { label: "Publico", value: briefing.audience },
              { label: "Produto", value: briefing.product },
              { label: "Oferta", value: briefing.offer },
              { label: "Tom", value: briefing.tone },
              { label: "CTA", value: briefing.cta },
            ].filter((item) => item.value).map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Strategy */}
        {strategyCopy?.strategy && (
          <Section title="Estrategia de Comunicacao" icon={Target}>
            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: "Angulo Principal", value: strategyCopy.strategy.angle },
                { label: "Proposta de Valor", value: strategyCopy.strategy.value_prop },
                { label: "Gatilho", value: strategyCopy.strategy.trigger },
                { label: "Abordagem", value: strategyCopy.strategy.approach },
              ].map((item) => (
                <div key={item.label} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Copy */}
        {strategyCopy?.copy && (
          <Section title="Copy da Peca" icon={Sparkles}>
            <div className="pt-4 space-y-3">
              <CopyField label="Headline 1" value={strategyCopy.copy.headline_1} />
              <CopyField label="Headline 2" value={strategyCopy.copy.headline_2} />
              <CopyField label="Texto Principal" value={strategyCopy.copy.body} />
              <div className="border-t border-border/50 pt-3 space-y-3">
                <CopyField label="Legenda Curta" value={strategyCopy.copy.caption_short} />
                <CopyField label="Legenda Longa" value={strategyCopy.copy.caption_long} />
              </div>
              <div className="border-t border-border/50 pt-3 space-y-3">
                <CopyField label="CTA Principal" value={strategyCopy.copy.cta_primary} />
                <CopyField label="CTA Alternativo" value={strategyCopy.copy.cta_secondary} />
                <CopyField label="Mensagem WhatsApp" value={strategyCopy.copy.cta_whatsapp} />
              </div>
            </div>
          </Section>
        )}

        {/* Creative Direction */}
        {creative && (
          <Section title="Direcao Criativa Visual" icon={Layers}>
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Estilo</p>
                  <p className="text-sm">{creative.visual_direction.style}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Mood</p>
                  <p className="text-sm">{creative.visual_direction.mood}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Cores</p>
                  <div className="flex flex-wrap gap-1">
                    {creative.visual_direction.colors.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded bg-muted border border-border">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Instrucao para Designer</p>
                  <CopyButton text={creative.designer_instruction} />
                </div>
                <p className="text-sm bg-muted/40 rounded-lg px-3 py-3 border border-border/50 leading-relaxed">{creative.designer_instruction}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prompt para IA de Imagem</p>
                  <CopyButton text={creative.image_prompt} />
                </div>
                <pre className="text-xs bg-muted/40 rounded-lg px-3 py-3 border border-border/50 font-mono whitespace-pre-wrap leading-relaxed text-accent">{creative.image_prompt}</pre>
              </div>
            </div>
          </Section>
        )}

        {/* Next Steps */}
        <Section title="Proximos Passos" icon={Zap} defaultOpen={false}>
          <div className="pt-4 space-y-3">
            {[
              creative && "Use o prompt de imagem no Canva, Midjourney ou Ideogram para gerar o visual",
              creative && "Aplique a instrucao de layout para posicionar os elementos",
              "Use a legenda longa no Instagram e a curta no WhatsApp",
              "Configure o CTA WhatsApp com link direto para seu numero",
              "Teste a peca com um pequeno grupo antes de publicar",
            ].filter(Boolean).map((text, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex justify-center pt-4 pb-8">
          <Button variant="outline" onClick={() => router.push(`/chat/${requestId}`)} className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Solicitar revisao ou ajuste
          </Button>
        </div>
      </main>
    </div>
  );
}
