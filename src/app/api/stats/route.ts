import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const [contentRes, sharesRes, usageRes] = await Promise.all([
    (admin as any).from("content").select("id, status, brand, type, quality_score"),
    (admin as any).from("shares").select("id, created_at"),
    (admin as any).from("usage_logs").select("tokens_input, tokens_output, cost_usd"),
  ]);

  const content = contentRes.data || [];
  const shares = sharesRes.data || [];
  const usage = usageRes.data || [];

  // Content stats
  const byStatus: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalScore = 0;
  let scoredCount = 0;
  let approvedCount = 0;

  content.forEach((c: any) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byBrand[c.brand] = (byBrand[c.brand] || 0) + 1;
    byType[c.type] = (byType[c.type] || 0) + 1;
    if (c.quality_score) { totalScore += c.quality_score; scoredCount++; }
    if (c.status === "aprovado" || c.status === "publicado") approvedCount++;
  });

  // Usage stats
  const totalTokens = usage.reduce((s: number, u: any) => s + (u.tokens_input || 0) + (u.tokens_output || 0), 0);
  const totalCost = usage.reduce((s: number, u: any) => s + (Number(u.cost_usd) || 0), 0);

  // Shares this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sharesThisWeek = shares.filter((s: any) => s.created_at >= weekAgo).length;

  return NextResponse.json({
    success: true,
    data: {
      content: { total: content.length, by_status: byStatus, by_brand: byBrand, by_type: byType },
      shares: { total: shares.length, this_week: sharesThisWeek },
      usage: { total_tokens: totalTokens, estimated_cost_usd: Math.round(totalCost * 1000) / 1000 },
      quality: {
        avg_score: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
        approval_rate: content.length > 0 ? Math.round((approvedCount / content.length) * 100) / 100 : 0,
      },
    },
  });
}
