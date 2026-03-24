import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const [worstRes, rejectRes] = await Promise.all([
    (admin as any).from("content")
      .select("id, title, type, brand, quality_score, created_at")
      .not("quality_score", "is", null)
      .order("quality_score", { ascending: true })
      .limit(3),
    (admin as any).from("content")
      .select("id, title, type, brand, rejection_reason, created_at")
      .eq("status", "rejeitado")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      worstScores: worstRes.data || [],
      rejections: rejectRes.data || [],
    },
  });
}
