"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createRequest } from "@/actions/requests";
import { REQUEST_EXAMPLES } from "@/lib/constants";

export function NewRequestModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = () => {
    if (!message.trim() || message.trim().length < 5) {
      toast.error("Descreva seu pedido com pelo menos 5 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const requestId = await createRequest(message.trim());
        toast.success("Solicitacao criada!");
        router.push(`/chat/${requestId}`);
        onClose();
      } catch (err) {
        toast.error("Erro ao criar solicitacao: " + (err as Error).message);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Solicitacao</DialogTitle>
          <DialogDescription>
            Descreva a peca de marketing que voce precisa. Nossos agentes de IA
            cuidam do resto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex: Preciso de um post para Instagram vendendo filtro de oleo com foco em oficinas mecanicas..."
            className="min-h-[120px] resize-none"
            disabled={isPending}
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
              Exemplos:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUEST_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setMessage(example)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors text-left"
                  disabled={isPending}
                >
                  {example.length > 60 ? example.slice(0, 60) + "..." : example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !message.trim()}
              className="gap-2"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
