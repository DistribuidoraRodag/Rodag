import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado" },
        { status: 401 }
      );
    }

    // Verify ownership via RLS
    const { data: request } = await supabase
      .from("requests")
      .select("id")
      .eq("id", requestId)
      .single();

    if (!request) {
      return NextResponse.json(
        { error: "Solicitacao nao encontrada" },
        { status: 404 }
      );
    }

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error("[GET /api/chat/[id]]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Nao autenticado" },
        { status: 401 }
      );
    }

    const { content } = await request.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Conteudo obrigatorio" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: reqData } = await supabase
      .from("requests")
      .select("id, status")
      .eq("id", requestId)
      .single();

    if (!reqData) {
      return NextResponse.json(
        { error: "Solicitacao nao encontrada" },
        { status: 404 }
      );
    }

    // Insert user message
    const { data: message, error: msgError } = await admin
      .from("chat_messages")
      .insert({
        request_id: requestId,
        user_id: user.id,
        role: "user",
        content: content.trim(),
        message_type: "text",
      })
      .select()
      .single();

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    // If status is "aguardando_complemento", check if answering pending questions
    if (reqData.status === "aguardando_complemento") {
      const { data: unansweredQuestions } = await admin
        .from("request_questions")
        .select("*")
        .eq("request_id", requestId)
        .is("answer_text", null)
        .order("question_order", { ascending: true });

      if (unansweredQuestions && unansweredQuestions.length > 0) {
        // Answer the first unanswered question with this message
        const nextQuestion = unansweredQuestions[0];

        await admin
          .from("request_questions")
          .update({
            answer_text: content.trim(),
            answered_at: new Date().toISOString(),
          })
          .eq("id", nextQuestion.id);

        // Check if all questions are now answered
        const remainingCount = unansweredQuestions.length - 1;

        if (remainingCount === 0) {
          // All questions answered - update status and trigger orchestrator
          await admin
            .from("requests")
            .update({ status: "briefing_em_montagem" })
            .eq("id", requestId);

          // Send confirmation message
          await admin.from("chat_messages").insert({
            request_id: requestId,
            user_id: user.id,
            role: "assistant",
            content:
              "Tenho tudo que preciso. Iniciando a producao da sua peca...",
            message_type: "status_update",
          });

          // Trigger orchestrator
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

          fetch(`${baseUrl}/api/agents/orchestrator`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, userId: user.id }),
          }).catch(console.error);
        } else {
          // Send the next question as assistant message
          const nextUnanswered = unansweredQuestions[1];
          if (nextUnanswered) {
            await admin.from("chat_messages").insert({
              request_id: requestId,
              user_id: user.id,
              role: "assistant",
              content: nextUnanswered.question_text,
              message_type: "question",
            });
          }
        }
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("[POST /api/chat/[id]]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
