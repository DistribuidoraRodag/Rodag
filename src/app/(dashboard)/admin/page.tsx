import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all metrics using parallel queries
  const [requestsRes, reviewRes, costsRes, qaRes] = await Promise.all([
    supabase.from("requests").select("id, status, created_at"),
    supabase.from("requests").select("id").eq("needs_human_review", true),
    supabase.from("agent_runs").select("cost_usd, model_used, agent_name"),
    supabase.from("deliverables").select("qa_score").not("qa_score", "is", null),
  ]);

  const requests = requestsRes.data || [];
  const reviewCount = reviewRes.data?.length || 0;
  const agentRuns = costsRes.data || [];
  const qaScores = qaRes.data || [];

  // Calculate metrics
  const totalRequests = requests.length;
  const delivered = requests.filter(r => r.status === "entregue_ao_cliente" || r.status === "entrega_finalizada").length;
  const processing = requests.filter(r => !["entregue_ao_cliente","entrega_finalizada","novo_pedido","aguardando_complemento"].includes(r.status)).length;
  const totalCost = agentRuns.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);
  const avgQA = qaScores.length > 0 ? qaScores.reduce((sum, r) => sum + (Number(r.qa_score) || 0), 0) / qaScores.length : 0;
  const successRate = totalRequests > 0 ? Math.round((delivered / totalRequests) * 100) : 0;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  requests.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  // Cost by model
  const costByModel: Record<string, number> = {};
  agentRuns.forEach(r => {
    const model = r.model_used || "desconhecido";
    costByModel[model] = (costByModel[model] || 0) + (Number(r.cost_usd) || 0);
  });

  return (
    <AdminDashboardClient
      totalRequests={totalRequests}
      delivered={delivered}
      processing={processing}
      reviewCount={reviewCount}
      totalCost={totalCost}
      avgQA={avgQA}
      successRate={successRate}
      statusCounts={statusCounts}
      costByModel={costByModel}
    />
  );
}
