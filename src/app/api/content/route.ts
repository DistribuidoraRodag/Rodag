import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateContent } from "@/lib/services/content-pipeline";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const url = request.nextUrl.searchParams;
  const status = url.get("status");
  const brand = url.get("brand");
  const channel = url.get("channel");
  const type = url.get("type");
  const search = url.get("search");
  const page = parseInt(url.get("page") || "1");
  const limit = parseInt(url.get("limit") || "20");
  const offset = (page - 1) * limit;

  const admin = createAdminClient();
  let query = (admin as any).from("content").select("*", { count: "exact" });

  // Role-based filtering
  const { data: profile } = await (admin as any).from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "client") {
    query = query.eq("status", "aprovado");
  }

  if (status) query = query.eq("status", status);
  if (brand) query = query.eq("brand", brand);
  if (channel) query = query.eq("channel", channel);
  if (type) query = query.eq("type", type);
  if (search) query = query.or(`title.ilike.%${search}%,body_text.ilike.%${search}%`);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    data: data || [],
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  try {
    const body = await request.json();
    const result = await generateContent({
      type: body.type || "post",
      brand: body.brand || "todas",
      channel: body.channel || "instagram",
      topic: body.topic || "",
      tone: body.tone || "profissional",
      output_level: body.output_level || 3,
      userId: user.id,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
