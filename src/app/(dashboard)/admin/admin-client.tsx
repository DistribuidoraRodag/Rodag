"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  CheckCircle2,
  DollarSign,
  Star,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface AdminDashboardClientProps {
  totalRequests: number;
  delivered: number;
  processing: number;
  reviewCount: number;
  totalCost: number;
  avgQA: number;
  successRate: number;
  statusCounts: Record<string, number>;
  costByModel: Record<string, number>;
}

const statusLabels: Record<string, string> = {
  novo_pedido: "Novo Pedido",
  aguardando_complemento: "Aguardando Complemento",
  intake_completo: "Intake Completo",
  briefing_gerado: "Briefing Gerado",
  estrategia_copy_gerada: "Estrategia/Copy Gerada",
  criativo_gerado: "Criativo Gerado",
  em_revisao_qa: "Em Revisao QA",
  aguardando_revisao_humana: "Aguardando Revisao Humana",
  entregue_ao_cliente: "Entregue ao Cliente",
  entrega_finalizada: "Entrega Finalizada",
};

const statusColors: Record<string, string> = {
  novo_pedido: "bg-blue-100 text-blue-800",
  aguardando_complemento: "bg-yellow-100 text-yellow-800",
  intake_completo: "bg-cyan-100 text-cyan-800",
  briefing_gerado: "bg-indigo-100 text-indigo-800",
  estrategia_copy_gerada: "bg-purple-100 text-purple-800",
  criativo_gerado: "bg-orange-100 text-orange-800",
  em_revisao_qa: "bg-pink-100 text-pink-800",
  aguardando_revisao_humana: "bg-red-100 text-red-800",
  entregue_ao_cliente: "bg-green-100 text-green-800",
  entrega_finalizada: "bg-emerald-100 text-emerald-800",
};

export default function AdminDashboardClient({
  totalRequests,
  delivered,
  processing,
  reviewCount,
  totalCost,
  avgQA,
  successRate,
  statusCounts,
  costByModel,
}: AdminDashboardClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground mt-1">
          Visao geral do sistema RODAG MKT
        </p>
      </div>

      {/* Main KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {delivered} entregues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              dos pedidos entregues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalCost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              USD em chamadas de IA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score QA Medio</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgQA.toFixed(1)}/10</div>
            <p className="text-xs text-muted-foreground">
              qualidade das entregas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos em Processamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processing}</div>
            <p className="text-xs text-muted-foreground">
              sendo processados pelo pipeline
            </p>
          </CardContent>
        </Card>

        <Card className={reviewCount > 0 ? "border-red-200 bg-red-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Revisao Humana</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${reviewCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${reviewCount > 0 ? "text-red-600" : ""}`}>
              {reviewCount}
            </div>
            {reviewCount > 0 ? (
              <Button asChild variant="link" className="px-0 text-red-600 h-auto py-0 mt-1">
                <Link href="/admin/revisao">Ver pedidos pendentes</Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                nenhum pedido pendente
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuicao por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(statusCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(statusCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusColors[status] || "bg-gray-100 text-gray-800"}
                          >
                            {statusLabels[status] || status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cost by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Custo por Modelo</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(costByModel).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum custo registrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Custo (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(costByModel)
                    .sort(([, a], [, b]) => b - a)
                    .map(([model, cost]) => (
                      <TableRow key={model}>
                        <TableCell className="font-mono text-sm">{model}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${cost.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
