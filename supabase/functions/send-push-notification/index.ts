// send-push-notification: internal — sends an Expo push to every registered
// token of a user and prunes tokens that come back DeviceNotRegistered.
// Requires the service-role key as the bearer token; never expose this to
// the client.
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, isServiceRole } from "../_shared/supabase.ts";

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!isServiceRole(req)) return json({ error: "unauthorized" }, 401);

  let body: { user_id?: unknown; title?: unknown; body?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { user_id, title, body: messageBody, data } = body;
  if (typeof user_id !== "string" || typeof title !== "string" || typeof messageBody !== "string") {
    return json({ error: "invalid_payload", message: "user_id, title and body are required." }, 400);
  }

  const admin = adminClient();
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("expo_token")
    .eq("user_id", user_id);

  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, pruned: 0 });
  }

  const pushMessages = tokens.map((t) => ({
    to: t.expo_token,
    title,
    body: messageBody,
    data: (data as Record<string, unknown> | undefined) ?? {},
    sound: "default",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pushMessages),
  });

  if (!res.ok) {
    return json({ error: "expo_api_error", status: res.status }, 502);
  }

  const result = (await res.json()) as { data?: ExpoTicket[] };
  const tickets = result.data ?? [];

  let pruned = 0;
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      await admin
        .from("push_tokens")
        .delete()
        .eq("expo_token", tokens[i].expo_token);
      pruned++;
    }
  }

  return json({ sent: pushMessages.length - pruned, pruned });
});
