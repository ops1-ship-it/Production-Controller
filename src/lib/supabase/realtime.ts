import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function subscribeToActiveProductionChanges(
  supabase: SupabaseClient<Database>,
  businessId: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`active-productions:${businessId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "production_batches",
        filter: `business_id=eq.${businessId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "production_notes",
      },
      onChange,
    )
    .subscribe();
}

export function unsubscribeFromRealtime(channel: RealtimeChannel) {
  void channel.unsubscribe();
}
