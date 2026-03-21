"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { answerQuestions, sendMessage, reopenRequest } from "@/actions/requests";
import { useRealtimeRequest } from "@/hooks/use-realtime-request";
import {
  STATUS_LABELS,
  PROCESSING_STATUSES,
  COMPLETED_STATUSES,
  AGENT_PIPELINE,
  getActiveAgentIndex,
} from "@/lib/constants";
import type { Database } from "@/types/database";

type Request = Database["public"]["Tables"]["requests"]["Row"];
type Message = Database["public"]["Tables"]["chat_messages"]["Row"];
type Question = Database["public"]["Tables"]["request_questions"]["Row"];

export function ChatClient({
  requestId,
  initialRequest,
  initialMessages,
  initialQuestions,
}: {
  requestId: string;
  initialRequest: Request;
  initialMessages: Message[];
  initialQuestions: Question[];
}) {
  const router = useRouter();
  const realtimeRequest = useRealtimeRequest(requestId, initialRequest);
  const request = realtimeRequest ?? initialRequest;

  const [messages, setMessages] = useState(initialMessages);
  const [questions] = useState(initialQuestions);
  const [inputText, setInputText] = useState("");
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const statusInfo = STATUS_LABELS[request.status] ?? {
    label: request.status,
    color: "text-muted-foreground",
    bgColor: "",
  };
  const isProcessing = PROCESSING_STATUSES.includes(request.status);
  const isCompleted = COMPLETED_STATUSES.includes(request.status);
  const isWaiting = request.status === "aguardando_complemento";
  const activeAgentIdx = getActiveAgentIndex(request.status);

  // Auto-refresh messages when status changes
  useEffect(() => {
    if (isProcessing || isCompleted) {
      const interval = setInterval(() => router.refresh(), 5000);
      return () => clearInterval(interval);
    }
  }, [request.status, isProcessing, isCompleted, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync messages from server
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const unansweredQuestions = questions.filter((q) => !q.answer_text);

  const handleAnswerSubmit = () => {
    const answers = unansweredQuestions
      .filter((q) => answerInputs[q.id]?.trim())
      .map((q) => ({ questionId: q.id, answer: answerInputs[q.id].trim() }));

    if (answers.length === 0) return;

    startTransition(async () => {
      try {
        await answerQuestions(requestId, answers);
        setAnswerInputs({});
        toast.success("Respostas enviadas!");
        router.refresh();
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    startTransition(async () => {
      try {
        if (isCompleted) {
          await reopenRequest(requestId, inputText.trim());
        } else {
          await sendMessage(requestId, inputText.trim());
        }
        setInputText("");
        router.refresh();
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-md flex-shrink-0">
        <div className="container flex items-center gap-4 h-16">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {request.initial_message}
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${statusInfo.bgColor} ${statusInfo.color} border text-xs`}
              >
                {isProcessing && (
                  <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
                )}
                {isCompleted && (
                  <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                )}
                {statusInfo.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            {isCompleted && (
              <Button
                size="sm"
                onClick={() => router.push(`/delivery/${requestId}`)}
              >
                Ver Entrega
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Agent Pipeline */}
      {(isProcessing || isCompleted) && (
        <div className="border-b border-border/50 bg-card/30 flex-shrink-0">
          <div className="container py-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {AGENT_PIPELINE.map((agent, i) => {
                const isDone = i < activeAgentIdx;
                const isActive = i === activeAgentIdx && isProcessing;
                return (
                  <div key={agent.id} className="flex items-center gap-1 flex-shrink-0">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        isDone
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : isActive
                            ? "bg-primary/15 border-primary/30 text-primary"
                            : "bg-muted/50 border-border text-muted-foreground"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isActive ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-current opacity-50" />
                      )}
                      {agent.label}
                    </div>
                    {i < AGENT_PIPELINE.length - 1 && (
                      <div
                        className={`w-4 h-px ${isDone ? "bg-emerald-500/40" : "bg-border"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="container py-6 space-y-4 max-w-3xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-primary/20"
                    : "bg-card border border-border"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4 text-primary" />
                ) : (
                  <Bot className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : msg.message_type === "delivery"
                      ? "bg-card border border-emerald-500/20 rounded-tl-sm w-full max-w-none"
                      : "bg-card border border-border rounded-tl-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                <div
                  className={`text-xs mt-1.5 flex items-center gap-1 ${
                    msg.role === "user"
                      ? "text-primary-foreground/60 justify-end"
                      : "text-muted-foreground"
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Agentes trabalhando na sua peca...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-md flex-shrink-0">
        <div className="container py-4 max-w-3xl mx-auto">
          {isWaiting && unansweredQuestions.length > 0 && (
            <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Responda as perguntas abaixo para continuar ({unansweredQuestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {unansweredQuestions.map((q, i) => (
                  <div key={q.id} className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground/90">
                      {i + 1}. {q.question_text}
                    </p>
                    <Input
                      value={answerInputs[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswerInputs((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Sua resposta..."
                      className="bg-muted/50 border-border text-sm"
                      disabled={isPending}
                    />
                  </div>
                ))}
                <Button
                  onClick={handleAnswerSubmit}
                  disabled={
                    isPending ||
                    unansweredQuestions.every((q) => !answerInputs[q.id]?.trim())
                  }
                  className="gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar respostas
                </Button>
              </CardContent>
            </Card>
          )}

          {!isWaiting && (
            <div className="flex gap-3 items-end">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isCompleted
                    ? "Solicite uma revisao ou ajuste na peca..."
                    : "Mensagem adicional..."
                }
                className="min-h-[52px] max-h-[160px] resize-none bg-muted/50 border-border text-sm flex-1"
                disabled={isProcessing || isPending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || isProcessing || isPending}
                size="icon"
                className="h-[52px] w-[52px] flex-shrink-0"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {isCompleted && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Peca concluida — voce pode solicitar revisoes ou{" "}
              <button
                onClick={() => router.push(`/delivery/${requestId}`)}
                className="text-primary hover:underline"
              >
                ver a entrega completa
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
