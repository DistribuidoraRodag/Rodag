import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AprovacaoClient from "./aprovacao-client";

export default async function AprovacaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data } = await (admin as any).from("content")
    .select("*")
    .in("status", ["pendente", "quality_check"])
    .order("created_at", { ascending: false });

  return <AprovacaoClient items={data || []} />;
}
