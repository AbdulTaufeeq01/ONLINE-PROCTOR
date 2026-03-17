import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

function _createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const createSupabaseBrowserClient = _createSupabaseBrowserClient;
export const createClient = _createSupabaseBrowserClient;
