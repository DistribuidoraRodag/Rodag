import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
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

    const { message } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Mensagem obrigatoria" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Create the request
    const { data: newRequest, error: reqError } = await admin
      .from("requests")
      .insert({
        user_id: user.id,
        initial_message: message.trim(),
        source_channel: "web",
        status: "novo_pedido",
      })
      .select()
      .single();

    if (reqError || !newRequest) {
      return NextResponse.json(
        { error: reqError?.message ?? "Erro ao criar solicitacao" },
        { status: 500 }
      );
    }

    // Insert first chat message (user)
    await admin.from("chat_messages").insert({
      request_id: newRequest.id,
      user_id: user.id,
      role: "user",
      content: message.trim(),
      message_type: "text",
    });

    // Log event
    await admin.from("request_events").insert({
      request_id: newRequest.id,
      event_type: "request_created",
      description: "Solicitacao criada via web",
    });

    // Trigger intake agent asynchronously
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    fetch(`${baseUrl}/api/agents/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: newRequest.id,
        userId: user.id,
        message: message.trim(),
      }),
    }).catch(console.error);

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("[POST /api/requests]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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

    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(requests);
  } catch (error) {
    console.error("[GET /api/requests]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
