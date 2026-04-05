import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getSupabaseClient() {
  const url = requireEnv("SUPABASE_URL");

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY is required");

  return createClient(url, key);
}

export function getSupabaseBucket() {
  return process.env.SUPABASE_BUCKET ?? "hostel-images";
}
