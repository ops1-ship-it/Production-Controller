export function getDb() {
  throw new Error(
    "Production Controller uses Supabase for application data. Use the shared Supabase clients in src/lib/supabase for runtime database access.",
  );
}
