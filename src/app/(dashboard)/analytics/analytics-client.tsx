"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, CheckCircle2, DollarSign, Star } from "lucide-react";

interface Props {
  content: Array<{ id: string; status: string; brand: string; type: string; quality_score: number; created_at: string }>;
  usageLogs: Array<{ agent: string; model: string; tokens_input: number; tokens_output: number; cost_usd: number; latency_ms: number; created_at: string }>;
}

export default function AnalyticsClient({ content, usageLogs }: Props) {
  const total = content.length;
  const approved = content.filter(c => c.status === "aprovado" || c.status === "publicado").length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const totalCost = usageLogs.reduce((s, u) => s + (Number(u.cost_usd) || 0), 0);
  const scores = content.filter(c => c.quality_score).map(c => c.quality_score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const byStatus: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  content.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byBrand[c.brand] = (byBrand[c.brand] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    rascunho: "secondary", pendente: "default", quality_check: "destructive",
    aprovado: "default", rejeitado: "destructive", publicado: "default", agendado: "secondary",
  };

  const brandColors: Record<string, string> = {
    scania: "bg-orange-500 text-white", volvo: "bg-blue-600 text-white",
    iveco: "bg-red-600 text-white", todas: "bg-gray-500 text-white",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Metricas de conteudo e uso de IA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-sm text-muted-foreground">Total Gerado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{approvalRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa Aprovacao</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">${totalCost.toFixed(3)}</p>
                <p className="text-sm text-muted-foreground">Custo Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{avgScore}/100</p>
                <p className="text-sm text-muted-foreground">Score QA Medio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <Badge variant={statusColors[status] as any || "secondary"}>{status}</Badge>
                  <span className="font-mono text-sm">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por Marca</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byBrand).map(([brand, count]) => (
                <div key={brand} className="flex justify-between items-center">
                  <Badge className={brandColors[brand] || ""}>{brand}</Badge>
                  <span className="font-mono text-sm">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ultimas Chamadas de IA</CardTitle></CardHeader>
        <CardContent>
          {usageLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum registro de uso.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Latencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs.slice(0, 10).map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{log.agent}</TableCell>
                    <TableCell className="text-xs">{log.model?.split("-").slice(-2).join("-")}</TableCell>
                    <TableCell className="font-mono text-xs">{(log.tokens_input || 0) + (log.tokens_output || 0)}</TableCell>
                    <TableCell className="font-mono text-xs">${Number(log.cost_usd || 0).toFixed(4)}</TableCell>
                    <TableCell className="font-mono text-xs">{log.latency_ms}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
