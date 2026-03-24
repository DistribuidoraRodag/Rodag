import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await (admin as any).from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Apenas admin pode rejeitar" }, { status: 403 });

  const body = await request.json();
  if (!body.reason) return NextResponse.json({ error: "Motivo obrigatorio" }, { status: 400 });

  await (admin as any).from("content").update({
    status: "rejeitado",
    rejection_reason: body.reason,
  }).eq("id", id);

  await (admin as any).from("approval_history").insert({
    content_id: id, action: "rejected", acted_by: user.id, notes: body.reason,
  });

  const { data: content } = await (admin as any).from("content").select("created_by, title").eq("id", id).single();
  if (content?.created_by) {
    await (admin as any).from("notifications").insert({
      user_id: content.created_by,
      title: "Conteudo precisa de ajustes",
      message: `"${content.title}" foi rejeitado: ${body.reason}`,
      type: "warning",
      link: `/gerar`,
    });
  }

  return NextResponse.json({ success: true });
}
