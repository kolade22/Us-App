// regenerate-invite-code: the creator invalidates the old code and gets a
// fresh 7-day code, only while the couple is still pending (no partner yet).
import { corsHeaders, json } from "../_shared/http.ts";
import { generateInviteCode, inviteExpiryIso, userClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const client = userClient(req);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const expiresAt = inviteExpiryIso();
    const { data, error } = await client.rpc("regenerate_invite_code", {
      p_new_code: code,
      p_expires_at: expiresAt,
    });

    if (error) {
      if (error.code === "23505") continue; // collision — try another code
      if (error.message.includes("no_pending_couple")) {
        return json({ error: "no_pending_couple", message: "No pending couple found for your account." }, 409);
      }
      if (error.message.includes("not_authenticated")) {
        return json({ error: "unauthorized" }, 401);
      }
      return json({ error: "regenerate_failed", message: error.message }, 400);
    }

    return json({ couple_id: data, invite_code: code, invite_code_expires_at: expiresAt });
  }

  return json({ error: "code_collision", message: "Could not generate a unique invite code. Try again." }, 500);
});
