// Shared Supabase clients + invite-code generation for US Edge Functions.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// Client that forwards the caller's JWT so security-definer RPCs see auth.uid().
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    },
  );
}

export function isServiceRole(req: Request): boolean {
  const authz = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return authz !== "" && authz === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

// Crockford base32-style alphabet: no 0/O, 1/I/L (and no U).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function inviteExpiryIso(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}
