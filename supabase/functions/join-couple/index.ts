// join-couple: rate-limited invite-code join. The database (row lock +
// UNIQUE constraints inside the join_couple RPC) is the source of truth for
// concurrency — this function only translates errors.
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

const MAX_ATTEMPTS_PER_HOUR = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { invite_code?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const code = body.invite_code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return json({ error: "invalid_code", message: "invite_code is required." }, 400);
  }

  const client = userClient(req);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Rate limiting: attempts counted per user (primary) and IP (fallback).
  const admin = adminClient();
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  await admin.from("join_attempts").insert({ user_id: user.id, ip });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("join_attempts")
    .select("*", { count: "exact", head: true })
    .gt("created_at", oneHourAgo)
    .or(`user_id.eq.${user.id},ip.eq.${ip}`);

  if ((count ?? 0) > MAX_ATTEMPTS_PER_HOUR) {
    return json({ error: "rate_limited", message: "Too many join attempts. Try again later." }, 429);
  }

  const { data, error } = await client.rpc("join_couple", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("invalid_or_expired_code")) {
      return json({ error: "invalid_code", message: "This invite code is invalid, already used, or expired." }, 400);
    }
    if (message.includes("couple_already_full")) {
      return json({ error: "couple_full", message: "This couple already has two members." }, 409);
    }
    // 'already in a couple': RPC pre-check; 'already_in_couple': the
    // couple_members_user_unique constraint fired mid-insert.
    if (message.includes("already in a couple") || message.includes("already_in_couple")) {
      return json({ error: "already_in_couple", message: "You are already part of a couple." }, 409);
    }
    if (message.includes("cannot_join_own_couple")) {
      return json({ error: "own_couple", message: "You cannot join a couple you created." }, 400);
    }
    if (message.includes("not_authenticated")) {
      return json({ error: "unauthorized" }, 401);
    }
    return json({ error: "join_failed", message }, 400);
  }

  return json({ couple_id: data, status: "active" });
});
