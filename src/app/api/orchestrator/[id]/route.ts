import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOrchestrator } from "@/agents/orchestrator";

export const maxDuration = 60;

export async function POST(
  request: Request,
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

    // Verify ownership
    const { data: reqData } = await supabase
      .from("requests")
      .select("id")
      .eq("id", requestId)
      .single();

    if (!reqData) {
      return NextResponse.json(
        { error: "Solicitacao nao encontrada" },
        { status: 404 }
      );
    }

    // Run orchestrator
    await runOrchestrator(requestId, user.id);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[POST /api/orchestrator/[id]]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
