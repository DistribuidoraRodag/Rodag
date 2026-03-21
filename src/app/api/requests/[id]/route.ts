import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get request (RLS ensures ownership)
    const { data: requestData, error: reqError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .single();

    if (reqError || !requestData) {
      return NextResponse.json(
        { error: "Solicitacao nao encontrada" },
        { status: 404 }
      );
    }

    // Get related data in parallel
    const [messagesResult, questionsResult, briefingsResult, deliverablesResult] =
      await Promise.all([
        supabase
          .from("chat_messages")
          .select("*")
          .eq("request_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("request_questions")
          .select("*")
          .eq("request_id", id)
          .order("question_order", { ascending: true }),
        supabase
          .from("request_briefings")
          .select("*")
          .eq("request_id", id)
          .order("briefing_version", { ascending: false })
          .limit(1),
        supabase
          .from("deliverables")
          .select("*")
          .eq("request_id", id)
          .order("created_at", { ascending: false }),
      ]);

    return NextResponse.json({
      request: requestData,
      messages: messagesResult.data ?? [],
      questions: questionsResult.data ?? [],
      briefing: briefingsResult.data?.[0] ?? null,
      deliverables: deliverablesResult.data ?? [],
    });
  } catch (error) {
    console.error("[GET /api/requests/[id]]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
