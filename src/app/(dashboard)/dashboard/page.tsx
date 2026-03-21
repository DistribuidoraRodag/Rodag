import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: requests } = await supabase
    .from("requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const allRequests = requests ?? [];

  const totalCount = allRequests.length;
  const inProgressCount = allRequests.filter((r) =>
    [
      "novo_pedido",
      "aguardando_complemento",
      "briefing_em_montagem",
      "briefing_fechado",
      "em_processamento_multiagente",
      "copy_pronta",
      "direcao_criativa_pronta",
      "imagem_gerada",
      "imagem_validada",
      "imagem_corrigida",
      "entrega_em_validacao",
      "precisa_revisao",
    ].includes(r.status)
  ).length;
  const deliveredCount = allRequests.filter((r) =>
    ["entrega_finalizada", "entregue_ao_cliente"].includes(r.status)
  ).length;

  const recentRequests = allRequests.slice(0, 5);

  return (
    <DashboardClient
      profile={profile}
      stats={{ total: totalCount, inProgress: inProgressCount, delivered: deliveredCount }}
      recentRequests={recentRequests}
    />
  );
}
