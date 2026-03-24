import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GerarClient from "./gerar-client";

export default async function GerarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <GerarClient />;
}
