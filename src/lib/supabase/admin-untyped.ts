import { createClient } from "@supabase/supabase-js";

// Untyped admin client for tables not yet in the generated Database type
// (brand_rules, product_catalog, restricted_terms, client_preferences,
//  image_validations, visual_corrections, request_state_history)
export function createUntypedAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
