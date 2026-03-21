"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { STATUS_LABELS, COMPLETED_STATUSES } from "@/lib/constants";
import type { Tables } from "@/types/database";

type Request = Tables<"requests">;

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "novo_pedido":
      return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    case "aguardando_complemento":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    case "em_processamento_multiagente":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "entrega_finalizada":
    case "entregue_ao_cliente":
      return "bg-green-500/20 text-green-300 border-green-500/30";
    case "precisa_revisao":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoricoClient({ requests }: { requests: Request[] }) {
  const router = useRouter();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historico</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Todas as suas solicitacoes de pecas de marketing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitacoes</CardTitle>
          <CardDescription>
            {requests.length} solicitacao{requests.length !== 1 ? "es" : ""} no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Nenhuma solicitacao encontrada.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const statusInfo = STATUS_LABELS[req.status];
                  const isDelivered = COMPLETED_STATUSES.includes(req.status);
                  const href = isDelivered
                    ? `/entrega/${req.id}`
                    : `/chat/${req.id}`;

                  return (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {req.title ?? req.initial_message}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.request_type?.replace(/_/g, " ") ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusBadgeClasses(req.status)}
                        >
                          {statusInfo?.label ?? req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(req.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
