"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Loader2,
  PlusCircle,
  Package,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { NewRequestModal } from "@/components/new-request-modal";
import {
  STATUS_LABELS,
  COMPLETED_STATUSES,
} from "@/lib/constants";
import type { Tables } from "@/types/database";

type Profile = Tables<"profiles">;
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
  });
}

export function DashboardClient({
  profile,
  stats,
  recentRequests,
}: {
  profile: Profile | null;
  stats: { total: number; inProgress: number; delivered: number };
  recentRequests: Request[];
}) {
  const router = useRouter();
  const [showNewRequest, setShowNewRequest] = useState(false);

  const statsCards = [
    {
      title: "Total de Pedidos",
      value: stats.total,
      icon: Package,
      description: "Todas as solicitacoes",
    },
    {
      title: "Em Andamento",
      value: stats.inProgress,
      icon: Loader2,
      description: "Em processamento",
    },
    {
      title: "Entregues",
      value: stats.delivered,
      icon: CheckCircle2,
      description: "Finalizados com sucesso",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Bem-vindo, {profile?.name?.split(" ")[0] ?? "Usuario"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas pecas de marketing
          </p>
        </div>
        <Button onClick={() => setShowNewRequest(true)} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Nova Solicitacao
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{card.title}</CardDescription>
                <card.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Solicitacoes Recentes</CardTitle>
              <CardDescription>Suas ultimas solicitacoes de pecas</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/historico">Ver tudo</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Nenhuma solicitacao ainda</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                Crie sua primeira solicitacao de peca de marketing.
              </p>
              <Button onClick={() => setShowNewRequest(true)} className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Criar primeira solicitacao
              </Button>
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
                {recentRequests.map((req) => {
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

      {showNewRequest && (
        <NewRequestModal onClose={() => setShowNewRequest(false)} />
      )}
    </div>
  );
}
