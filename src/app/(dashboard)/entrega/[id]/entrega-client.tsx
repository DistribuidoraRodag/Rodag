"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type Request = Tables<"requests">;
type Deliverable = Tables<"deliverables">;

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
      title="Copiar"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        <CopyButton text={value} />
      </div>
      <p className="text-sm bg-muted/40 rounded-lg px-3 py-2 border border-border/50 leading-relaxed">
        {value}
      </p>
    </div>
  );
}

function QAScoreBadge({ score, approved }: { score: number; approved: boolean }) {
  const color = approved
    ? "bg-green-500/20 text-green-300 border-green-500/30"
    : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";

  return (
    <Badge variant="outline" className={`text-base px-3 py-1 ${color}`}>
      QA: {score}/10 {approved ? "- Aprovado" : "- Pendente"}
    </Badge>
  );
}

function CopyDeliverable({ deliverable }: { deliverable: Deliverable }) {
  const content = deliverable.content_json as Record<string, unknown> | null;
  if (!content) return null;

  const copy = content as {
    headline_1?: string;
    headline_2?: string;
    body?: string;
    caption_short?: string;
    caption_long?: string;
    cta_primary?: string;
    cta_secondary?: string;
    cta_whatsapp?: string;
    headline?: string;
    cta?: string;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {deliverable.title ?? "Copy"}
            </CardTitle>
            <CardDescription>Textos da peca</CardDescription>
          </div>
        </div>
        {deliverable.qa_score != null && (
          <QAScoreBadge
            score={deliverable.qa_score}
            approved={deliverable.approved}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <CopyField label="Headline" value={copy.headline_1 ?? copy.headline ?? ""} />
        {copy.headline_2 && <CopyField label="Headline 2" value={copy.headline_2} />}
        <CopyField label="Texto Principal" value={copy.body ?? ""} />
        {copy.caption_short && <CopyField label="Legenda Curta" value={copy.caption_short} />}
        {copy.caption_long && <CopyField label="Legenda Longa" value={copy.caption_long} />}
        <CopyField label="CTA" value={copy.cta_primary ?? copy.cta ?? ""} />
        {copy.cta_secondary && <CopyField label="CTA Alternativo" value={copy.cta_secondary} />}
        {copy.cta_whatsapp && <CopyField label="Mensagem WhatsApp" value={copy.cta_whatsapp} />}
      </CardContent>
    </Card>
  );
}

function CreativeDirectionDeliverable({ deliverable }: { deliverable: Deliverable }) {
  const content = deliverable.content_json as Record<string, unknown> | null;
  if (!content) return null;

  const creative = content as {
    visual_direction?: { style?: string; colors?: string[]; hierarchy?: string[]; mood?: string };
    layout?: { format?: string; top?: string; center?: string; bottom_left?: string; bottom_right?: string; corner?: string };
    image_prompt?: string;
    designer_instruction?: string;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {deliverable.title ?? "Direcao Criativa"}
            </CardTitle>
            <CardDescription>Direcao visual e layout</CardDescription>
          </div>
        </div>
        {deliverable.qa_score != null && (
          <QAScoreBadge
            score={deliverable.qa_score}
            approved={deliverable.approved}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {creative.visual_direction && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {creative.visual_direction.style && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Estilo</p>
                <p className="text-sm">{creative.visual_direction.style}</p>
              </div>
            )}
            {creative.visual_direction.mood && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Mood</p>
                <p className="text-sm">{creative.visual_direction.mood}</p>
              </div>
            )}
            {creative.visual_direction.colors && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border/50 col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Cores</p>
                <div className="flex flex-wrap gap-1">
                  {creative.visual_direction.colors.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-2 py-0.5 rounded bg-muted border border-border"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {creative.layout && (
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
              Layout
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(creative.layout).map(([key, value]) =>
                value ? (
                  <div
                    key={key}
                    className="bg-muted/30 rounded-lg p-2 border border-border/50"
                  >
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm">{value}</p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {creative.designer_instruction && (
          <CopyField label="Instrucao para Designer" value={creative.designer_instruction} />
        )}
        {creative.image_prompt && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Prompt para IA de Imagem
              </span>
              <CopyButton text={creative.image_prompt} />
            </div>
            <pre className="text-xs bg-muted/40 rounded-lg px-3 py-3 border border-border/50 font-mono whitespace-pre-wrap leading-relaxed">
              {creative.image_prompt}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImageDeliverable({ deliverable }: { deliverable: Deliverable }) {
  if (!deliverable.image_url) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {deliverable.title ?? "Imagem Gerada"}
            </CardTitle>
            <CardDescription>Arte gerada por IA</CardDescription>
          </div>
        </div>
        {deliverable.qa_score != null && (
          <QAScoreBadge
            score={deliverable.qa_score}
            approved={deliverable.approved}
          />
        )}
      </CardHeader>
      <CardContent>
        <img
          src={deliverable.image_url}
          alt={deliverable.title ?? "Imagem gerada"}
          className="rounded-lg border border-border w-full max-w-lg mx-auto"
        />
      </CardContent>
    </Card>
  );
}

function GenericDeliverable({ deliverable }: { deliverable: Deliverable }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">
              {deliverable.title ?? deliverable.deliverable_type}
            </CardTitle>
            <CardDescription>Versao {deliverable.version}</CardDescription>
          </div>
        </div>
        {deliverable.qa_score != null && (
          <QAScoreBadge
            score={deliverable.qa_score}
            approved={deliverable.approved}
          />
        )}
      </CardHeader>
      {deliverable.content_text && (
        <CardContent>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {deliverable.content_text}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function renderDeliverable(deliverable: Deliverable) {
  switch (deliverable.deliverable_type) {
    case "copy":
      return <CopyDeliverable key={deliverable.id} deliverable={deliverable} />;
    case "creative_direction":
      return (
        <CreativeDirectionDeliverable
          key={deliverable.id}
          deliverable={deliverable}
        />
      );
    case "generated_image":
      return <ImageDeliverable key={deliverable.id} deliverable={deliverable} />;
    default:
      return <GenericDeliverable key={deliverable.id} deliverable={deliverable} />;
  }
}

export function EntregaClient({
  request,
  deliverables,
}: {
  request: Request;
  deliverables: Deliverable[];
}) {
  const router = useRouter();

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Dashboard
      </button>

      {/* Request Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle>{request.title ?? "Solicitacao"}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {request.initial_message}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {request.request_type && (
              <Badge variant="secondary">
                {request.request_type.replace(/_/g, " ")}
              </Badge>
            )}
            {request.product_line && (
              <Badge variant="secondary">{request.product_line}</Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Deliverables */}
      {deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Eye className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            Entrega ainda nao disponivel.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push(`/chat/${request.id}`)}
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Acompanhar no Chat
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {deliverables.map((d) => renderDeliverable(d))}
        </div>
      )}

      {/* Action button */}
      {deliverables.length > 0 && (
        <div className="flex justify-center pt-4 pb-8">
          <Button
            variant="outline"
            onClick={() => router.push(`/chat/${request.id}`)}
            className="gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Solicitar revisao
          </Button>
        </div>
      )}
    </div>
  );
}
