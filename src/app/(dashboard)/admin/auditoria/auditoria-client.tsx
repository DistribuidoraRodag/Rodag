"use client";

import { FileText } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Event {
  id: string;
  request_id: string;
  event_type: string;
  description: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface AuditoriaClientProps {
  events: Event[];
}

const eventTypeColors: Record<string, string> = {
  intake_completed: "bg-blue-100 text-blue-800",
  briefing_completed: "bg-green-100 text-green-800",
  strategy_copy_completed: "bg-purple-100 text-purple-800",
  creative_completed: "bg-orange-100 text-orange-800",
  delivery_completed: "bg-emerald-100 text-emerald-800",
  orchestrator_error: "bg-red-100 text-red-800",
  fallback_generated: "bg-yellow-100 text-yellow-800",
  image_validation: "bg-sky-100 text-sky-800",
  qa_review: "bg-violet-100 text-violet-800",
};

const eventTypeLabels: Record<string, string> = {
  intake_completed: "Intake Concluido",
  briefing_completed: "Briefing Concluido",
  strategy_copy_completed: "Estrategia/Copy Concluida",
  creative_completed: "Criativo Concluido",
  delivery_completed: "Entrega Concluida",
  orchestrator_error: "Erro do Orquestrador",
  fallback_generated: "Fallback Gerado",
  image_validation: "Validacao de Imagem",
  qa_review: "Revisao QA",
};

function shortId(id: string): string {
  return id.substring(0, 8);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditoriaClient({ events }: AuditoriaClientProps) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria do Sistema</h1>
        <p className="text-muted-foreground mt-1">
          Historico completo de eventos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Recentes</CardTitle>
          <CardDescription>
            Ultimos {events.length} eventos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum evento registrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Os eventos aparecerao aqui conforme o sistema processar pedidos
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo de Evento</TableHead>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Descricao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(event.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={eventTypeColors[event.event_type] || "bg-gray-100 text-gray-800"}
                        >
                          {eventTypeLabels[event.event_type] || event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {shortId(event.request_id)}
                      </TableCell>
                      <TableCell className="text-sm max-w-md truncate">
                        {event.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
