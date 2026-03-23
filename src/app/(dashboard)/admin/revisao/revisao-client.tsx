"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
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

interface Request {
  id: string;
  initial_message: string | null;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface RevisaoClientProps {
  requests: Request[];
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

function shortId(id: string): string {
  return id.substring(0, 8);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string | null, maxLen: number = 60): string {
  if (!text) return "—";
  return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
}

export default function RevisaoClient({ requests }: RevisaoClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revisao Humana</h1>
        <p className="text-muted-foreground mt-1">
          Pedidos que o QA nao conseguiu aprovar automaticamente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Pendentes</CardTitle>
          <CardDescription>
            {requests.length} pedido{requests.length !== 1 ? "s" : ""} aguardando revisao
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">Tudo em dia!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhum pedido aguardando revisao
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Mensagem Inicial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {shortId(request.id)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {truncate(request.initial_message)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        {statusLabels[request.status] || request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(request.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/chat/${request.id}`}>Ver Detalhes</Link>
                      </Button>
                    </TableCell>
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
