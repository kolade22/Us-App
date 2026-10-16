// create-couple: authenticated user creates a pending couple, becomes
// partner_a, and receives a 7-day-expiring invite code (collision-checked).
import { corsHeaders, json } from "../_shared/http.ts";
import { generateInviteCode, inviteExpiryIso, userClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { relationship_start_date?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const startDate = body.relationship_start_date;
  if (
    typeof startDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    Number.isNaN(Date.parse(startDate))
  ) {
    return json({ error: "invalid_start_date", message: "relationship_start_date must be a valid YYYY-MM-DD date." }, 400);
  }

  const client = userClient(req);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const expiresAt = inviteExpiryIso();
    const { data, error } = await client.rpc("create_couple", {
      p_start_date: startDate,
      p_invite_code: code,
      p_expires_at: expiresAt,
    });

    if (error) {
      if (error.code === "23505") continue; // invite-code collision — try another code
      if (error.message.includes("already in a couple")) {
        return json({ error: "already_in_couple", message: "You are already part of a couple." }, 409);
      }
      if (error.message.includes("not_authenticated")) {
        return json({ error: "unauthorized" }, 401);
      }
      return json({ error: "create_failed", message: error.message }, 400);
    }

    return json({ couple_id: data, invite_code: code, invite_code_expires_at: expiresAt, status: "pending" });
  }

  return json({ error: "code_collision", message: "Could not generate a unique invite code. Try again." }, 500);
});
