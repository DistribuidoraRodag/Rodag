import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, Bot, FileText, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">RODAG MKT SYSTEM</span>
        </div>
        <Button asChild size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>

      <section className="container py-24 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          Pecas de marketing prontas com IA multiagente
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Descreva o que voce precisa em linguagem natural. Nosso sistema de agentes
          especializados cria copy, estrategia e direcao visual automaticamente.
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/login">
            Comecar agora
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </section>

      <section className="container pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl border border-border bg-card">
            <Bot className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Multiagentes IA</h3>
            <p className="text-sm text-muted-foreground">
              5 agentes especializados trabalham em sequencia: intake, briefing,
              estrategia, copy e validacao.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-border bg-card">
            <FileText className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Briefing inteligente</h3>
            <p className="text-sm text-muted-foreground">
              O sistema faz de 3 a 5 perguntas minimas para fechar o briefing.
              Sem formularios longos.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-border bg-card">
            <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">QA automatico</h3>
            <p className="text-sm text-muted-foreground">
              Nenhuma peca sai sem validacao. Score de qualidade, retry
              automatico e revisao humana quando necessario.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
