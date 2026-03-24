import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const channel = body.channel || "whatsapp";

  const admin = createAdminClient();
  const { data: content } = await (admin as any).from("content").select("body_text, title").eq("id", id).single();
  if (!content) return NextResponse.json({ error: "Conteudo nao encontrado" }, { status: 404 });

  await (admin as any).from("shares").insert({
    content_id: id, shared_by: user.id, channel,
  });

  const encodedText = encodeURIComponent(`${content.title}\n\n${content.body_text}`);
  const whatsappLink = `https://wa.me/?text=${encodedText}`;

  return NextResponse.json({ success: true, whatsapp_link: whatsappLink });
}
