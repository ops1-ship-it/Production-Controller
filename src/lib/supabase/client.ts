import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "./env";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const env = getSupabaseBrowserEnv();
  if (!env.isConfigured) {
    throw new Error(env.message);
  }

  browserClient = createBrowserClient<Database>(env.url, env.publishableKey);
  return browserClient;
}
