import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HistoricoClient } from "./historico-client";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: requests } = await supabase
    .from("requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <HistoricoClient requests={requests ?? []} />;
}
