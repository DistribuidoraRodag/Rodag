import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AuditoriaClient from "./auditoria-client";

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("request_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditoriaClient events={events || []} />;
}
