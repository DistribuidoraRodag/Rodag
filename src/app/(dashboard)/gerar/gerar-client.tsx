"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GerarClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    type: "post",
    brand: "todas",
    channel: "instagram",
    topic: "",
    tone: "profissional",
    output_level: 3,
    icp: "",
    funnel_stage: "awareness",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.topic.trim()) { toast.error("Informe o tema"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      toast.success("Conteudo gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar conteudo");
    } finally {
      setLoading(false);
    }
  }

  const brandColors: Record<string, string> = {
    scania: "bg-orange-500", volvo: "bg-blue-600", iveco: "bg-red-600", todas: "bg-gray-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerar Conteudo</h1>
        <p className="text-muted-foreground">Crie pecas de marketing com IA multiagente</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Conteudo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="promo">Promocional</SelectItem>
                    <SelectItem value="tecnico">Tecnico</SelectItem>
                    <SelectItem value="institucional">Institucional</SelectItem>
                    <SelectItem value="lancamento">Lancamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scania">Scania</SelectItem>
                    <SelectItem value="volvo">Volvo</SelectItem>
                    <SelectItem value="iveco">Iveco</SelectItem>
                    <SelectItem value="todas">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tema / Descricao</Label>
              <Textarea
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                placeholder="Ex: Cubo redutor Scania R450 em estoque com preco especial"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ICP (Publico-Alvo)</Label>
                <Select value={form.icp || ""} onValueChange={v => setForm(f => ({ ...f, icp: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o ICP" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oficinas">Oficinas Mecanicas</SelectItem>
                    <SelectItem value="transportadoras">Transportadoras</SelectItem>
                    <SelectItem value="frotistas">Frotistas</SelectItem>
                    <SelectItem value="lojistas">Lojistas de Autopecas</SelectItem>
                    <SelectItem value="geral">Todos os segmentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Etapa do Funil</Label>
                <Select value={form.funnel_stage} onValueChange={v => setForm(f => ({ ...f, funnel_stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awareness">Awareness (Descoberta)</SelectItem>
                    <SelectItem value="interest">Interest (Interesse)</SelectItem>
                    <SelectItem value="consideration">Consideration (Comparacao)</SelectItem>
                    <SelectItem value="conversion">Conversion (Compra)</SelectItem>
                    <SelectItem value="retention">Retention (Pos-venda)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="tecnico">Tecnico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nivel de Output</Label>
                <Select value={String(form.output_level)} onValueChange={v => setForm(f => ({ ...f, output_level: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Rapido</SelectItem>
                    <SelectItem value="2">2 - Estruturado</SelectItem>
                    <SelectItem value="3">3 - Completo</SelectItem>
                    <SelectItem value="4">4 - Producao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</> : <><Sparkles className="w-4 h-4 mr-2" />Gerar Conteudo</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {result.title}
              <Badge variant={result.quality_score >= 70 ? "default" : result.quality_score >= 50 ? "secondary" : "destructive"}>
                Score: {result.quality_score}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap">{result.body_text}</p>
            <div className="flex gap-2">
              <Badge className={brandColors[form.brand]}>{form.brand}</Badge>
              <Badge variant="outline">{form.channel}</Badge>
              <Badge variant="outline">{form.type}</Badge>
              <Badge variant={result.status === "pendente" ? "default" : "secondary"}>{result.status}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
