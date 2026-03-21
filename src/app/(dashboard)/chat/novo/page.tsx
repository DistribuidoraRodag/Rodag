"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { REQUEST_EXAMPLES } from "@/lib/constants";

export default function NovasolicitacaoPage() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = () => {
    const text = message.trim();
    if (!text || text.length < 5) {
      toast.error("Descreva seu pedido com pelo menos 5 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Erro ao criar solicitacao");
        }

        const data = await res.json();
        toast.success("Solicitacao criada!");
        router.push(`/chat/${data.id}`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Nova Solicitacao</CardTitle>
          <CardDescription>
            Descreva a peca de marketing que voce precisa. Nossos agentes de IA
            cuidam do resto.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o que voce precisa..."
            className="min-h-[160px] resize-none text-base"
            disabled={isPending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Exemplos de pedidos:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUEST_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setMessage(example)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors text-left"
                  disabled={isPending}
                >
                  {example.length > 65 ? example.slice(0, 65) + "..." : example}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isPending || !message.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar solicitacao
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ctrl+Enter para enviar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
