import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EntregaClient } from "./entrega-client";

export default async function EntregaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!request) redirect("/dashboard");

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: false });

  return (
    <EntregaClient
      request={request}
      deliverables={deliverables ?? []}
    />
  );
}
