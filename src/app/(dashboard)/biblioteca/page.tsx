import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import BibliotecaClient from "./biblioteca-client";

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data } = await (admin as any).from("content")
    .select("*")
    .eq("status", "aprovado")
    .order("created_at", { ascending: false });

  return <BibliotecaClient items={data || []} />;
}
