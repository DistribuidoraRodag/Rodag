"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createRequest(message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("requests")
    .insert({
      user_id: user.id,
      initial_message: message,
      source_channel: "web",
      status: "novo_pedido",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Save user message to chat
  await supabase.from("chat_messages").insert({
    request_id: data.id,
    user_id: user.id,
    role: "user",
    content: message,
    message_type: "text",
  });

  // Trigger intake agent (runs async on server)
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${getBaseUrl()}/api/agents/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: data.id, userId: user.id, message }),
  }).catch(console.error);

  revalidatePath("/dashboard");
  return data.id;
}

export async function answerQuestions(
  requestId: string,
  answers: { questionId: string; answer: string }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Save each answer
  for (const ans of answers) {
    await admin
      .from("request_questions")
      .update({ answer_text: ans.answer, answered_at: new Date().toISOString() })
      .eq("id", ans.questionId);
  }

  // Save as chat message
  const answersText = answers.map((a) => a.answer).join(" | ");
  await supabase.from("chat_messages").insert({
    request_id: requestId,
    user_id: user.id,
    role: "user",
    content: answersText,
    message_type: "text",
  });

  // Check if all questions answered
  const { data: unanswered } = await admin
    .from("request_questions")
    .select("id")
    .eq("request_id", requestId)
    .is("answer_text", null);

  if (!unanswered || unanswered.length === 0) {
    // All answered — trigger orchestrator
    await admin
      .from("chat_messages")
      .insert({
        request_id: requestId,
        user_id: user.id,
        role: "assistant",
        content: "Tenho tudo que preciso. Iniciando a produção da sua peça...",
        message_type: "status_update",
      });

    fetch(`${getBaseUrl()}/api/agents/orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, userId: user.id }),
    }).catch(console.error);
  }

  revalidatePath(`/chat/${requestId}`);
}

export async function sendMessage(requestId: string, message: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("chat_messages").insert({
    request_id: requestId,
    user_id: user.id,
    role: "user",
    content: message,
    message_type: "text",
  });

  revalidatePath(`/chat/${requestId}`);
}

export async function reopenRequest(requestId: string, message: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("chat_messages").insert({
    request_id: requestId,
    user_id: user.id,
    role: "user",
    content: message,
    message_type: "text",
  });

  await admin
    .from("chat_messages")
    .insert({
      request_id: requestId,
      user_id: user.id,
      role: "assistant",
      content: "Entendido! Vou revisar sua peça com as novas instruções...",
      message_type: "status_update",
    });

  await admin
    .from("requests")
    .update({ status: "em_processamento_multiagente" })
    .eq("id", requestId);

  // Get original request for orchestrator
  const { data: request } = await admin
    .from("requests")
    .select("initial_message, revision_count")
    .eq("id", requestId)
    .single();

  if (request) {
    fetch(`${getBaseUrl()}/api/agents/orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        userId: user.id,
        revisedMessage: `${request.initial_message}\n\nRevisão solicitada: ${message}`,
      }),
    }).catch(console.error);
  }

  revalidatePath(`/chat/${requestId}`);
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
