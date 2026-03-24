import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [contentRes, usageRes] = await Promise.all([
    (admin as any).from("content").select("id, status, brand, type, quality_score, created_at"),
    (admin as any).from("usage_logs").select("agent, model, tokens_input, tokens_output, cost_usd, latency_ms, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <AnalyticsClient
      content={contentRes.data || []}
      usageLogs={usageRes.data || []}
    />
  );
}
