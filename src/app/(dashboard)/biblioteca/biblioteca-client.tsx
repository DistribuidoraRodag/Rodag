"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Search } from "lucide-react";
import { toast } from "sonner";

interface ContentItem {
  id: string; title: string; body_text: string; brand: string;
  channel: string; type: string; quality_score: number; hashtags: string[];
}

const brandColors: Record<string, string> = {
  scania: "bg-orange-500 text-white", volvo: "bg-blue-600 text-white",
  iveco: "bg-red-600 text-white", todas: "bg-gray-500 text-white",
};

export default function BibliotecaClient({ items: initial }: { items: ContentItem[] }) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const filtered = initial.filter(item => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.body_text.toLowerCase().includes(search.toLowerCase());
    const matchBrand = !brandFilter || item.brand === brandFilter;
    return matchSearch && matchBrand;
  });

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Texto copiado!");
  }

  async function shareWhatsApp(id: string) {
    try {
      const res = await fetch(`/api/content/${id}/share`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp" }),
      });
      const data = await res.json();
      if (data.whatsapp_link) window.open(data.whatsapp_link, "_blank");
      toast.success("Compartilhamento registrado");
    } catch { toast.error("Erro ao compartilhar"); }
  }

  const brands = ["scania", "volvo", "iveco", "todas"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Biblioteca de Conteudos</h1>
        <p className="text-muted-foreground">{filtered.length} conteudo(s) aprovado(s)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por titulo ou texto..." className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Button variant={!brandFilter ? "default" : "outline"} size="sm" onClick={() => setBrandFilter(null)}>Todas</Button>
          {brands.map(b => (
            <Button key={b} variant={brandFilter === b ? "default" : "outline"} size="sm" onClick={() => setBrandFilter(b)} className="capitalize">{b}</Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum conteudo encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="line-clamp-1">{item.title}</span>
                  <Badge className={brandColors[item.brand] || ""} >{item.brand}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-4">{item.body_text}</p>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">{item.channel}</Badge>
                  <Badge variant="outline" className="text-xs">{item.type}</Badge>
                  <Badge variant="secondary" className="text-xs">Score: {item.quality_score}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => copyText(item.body_text)}>
                    <Copy className="w-3 h-3 mr-1" />Copiar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => shareWhatsApp(item.id)}>
                    <Share2 className="w-3 h-3 mr-1" />WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
