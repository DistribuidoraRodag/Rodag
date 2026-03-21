import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DeliveryClient } from "./delivery-client";

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!request) redirect("/dashboard");

  const { data: delivery } = await supabase
    .from("deliverables")
    .select("*")
    .eq("request_id", id)
    .eq("deliverable_type", "full_delivery")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  return (
    <DeliveryClient
      requestId={id}
      request={request}
      delivery={delivery}
    />
  );
}
