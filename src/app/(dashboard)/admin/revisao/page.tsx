import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RevisaoClient from "./revisao-client";

export default async function RevisaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: requests } = await supabase
    .from("requests")
    .select("*")
    .eq("needs_human_review", true)
    .order("created_at", { ascending: false });

  return <RevisaoClient requests={requests || []} />;
}
