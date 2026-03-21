import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChatClient } from "./chat-client";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: request },
    { data: messages },
    { data: questions },
  ] = await Promise.all([
    supabase.from("requests").select("*").eq("id", id).single(),
    supabase.from("chat_messages").select("*").eq("request_id", id).order("created_at"),
    supabase.from("request_questions").select("*").eq("request_id", id).order("question_order"),
  ]);

  if (!request) redirect("/dashboard");

  return (
    <ChatClient
      requestId={id}
      initialRequest={request}
      initialMessages={messages ?? []}
      initialQuestions={questions ?? []}
    />
  );
}
