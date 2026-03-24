"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ContentItem {
  id: string; title: string; body_text: string; brand: string; channel: string;
  type: string; quality_score: number; status: string; created_at: string;
}

const brandColors: Record<string, string> = {
  scania: "bg-orange-500 text-white", volvo: "bg-blue-600 text-white",
  iveco: "bg-red-600 text-white", todas: "bg-gray-500 text-white",
};

export default function AprovacaoClient({ items: initial }: { items: ContentItem[] }) {
  const [items, setItems] = useState(initial);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function approve(id: string) {
    const res = await fetch(`/api/content/${id}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) { setItems(items.filter(i => i.id !== id)); toast.success("Conteudo aprovado"); }
    else toast.error("Erro ao aprovar");
  }

  async function reject() {
    if (!rejectId || !reason.trim()) { toast.error("Informe o motivo"); return; }
    const res = await fetch(`/api/content/${rejectId}/reject`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    if (res.ok) { setItems(items.filter(i => i.id !== rejectId)); setRejectId(null); setReason(""); toast.success("Conteudo rejeitado"); }
    else toast.error("Erro ao rejeitar");
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-semibold">Nenhum conteudo pendente</h2>
        <p className="text-muted-foreground">Todos os conteudos foram revisados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fila de Aprovacao</h1>
        <p className="text-muted-foreground">{items.length} conteudo(s) aguardando revisao</p>
      </div>

      <div className="space-y-4">
        {items.map(item => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{item.title}</span>
                <div className="flex gap-2">
                  <Badge className={brandColors[item.brand] || ""}>{item.brand}</Badge>
                  <Badge variant="outline">{item.channel}</Badge>
                  <Badge variant={item.quality_score >= 70 ? "default" : "destructive"}>
                    {item.quality_score < 70 && <AlertTriangle className="w-3 h-3 mr-1" />}
                    Score: {item.quality_score}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-wrap line-clamp-6">{item.body_text}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="destructive" size="sm" onClick={() => { setRejectId(item.id); setReason(""); }}>
                  <XCircle className="w-4 h-4 mr-1" />Rejeitar
                </Button>
                <Button size="sm" onClick={() => approve(item.id)} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-1" />Aprovar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo da rejeicao</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva o que precisa ser ajustado..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject}>Confirmar Rejeicao</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
