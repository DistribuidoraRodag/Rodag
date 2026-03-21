"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Request = Database["public"]["Tables"]["requests"]["Row"];

export function useRealtimeRequest(requestId: string, initialData: Request | null) {
  const [request, setRequest] = useState<Request | null>(initialData);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`request-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          setRequest(payload.new as Request);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  return request;
}
