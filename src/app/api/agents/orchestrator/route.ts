import { NextResponse } from "next/server";
import { runOrchestrator } from "@/agents/orchestrator";

export const maxDuration = 60; // Allow up to 60s for the full pipeline

export async function POST(request: Request) {
  try {
    const { requestId, userId, revisedMessage } = await request.json();

    if (!requestId || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Run orchestrator — this is the long-running pipeline
    await runOrchestrator(requestId, userId, revisedMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Orchestrator Error]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
