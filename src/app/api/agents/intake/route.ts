import { NextResponse } from "next/server";
import { runIntakeAgent } from "@/agents/intake";

export async function POST(request: Request) {
  try {
    const { requestId, userId, message } = await request.json();

    if (!requestId || !userId || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const result = await runIntakeAgent(requestId, userId, message);

    // If no followup needed, trigger orchestrator
    if (!result.needs_followup) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      fetch(`${baseUrl}/api/agents/orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, userId }),
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Intake Agent Error]", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
