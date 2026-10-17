// send-push-notification: sends an Expo push to every registered token of a
// user and prunes tokens that come back DeviceNotRegistered.
//
// Two callers:
//  - service role (internal/scheduled): sends to body.user_id with the given
//    title and body.
//  - a signed-in user: posts { message_id } and can only notify their own
//    partner. Title and text are read from the stored message, so a client
//    cannot target another user or spoof the content.
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, isServiceRole, userClient } from "../_shared/supabase.ts";

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type Body = {
  user_id?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
  message_id?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const admin = adminClient();
  let recipient: string;
  let title: string;
  let messageBody: string;
  let data: Record<string, unknown>;

  if (isServiceRole(req)) {
    const { user_id, title: rawTitle, body: rawBody, data: rawData } = body;
    if (typeof user_id !== "string" || typeof rawTitle !== "string" || typeof rawBody !== "string") {
      return json({ error: "invalid_payload", message: "user_id, title and body are required." }, 400);
    }
    recipient = user_id;
    title = rawTitle;
    messageBody = rawBody;
    data = (rawData as Record<string, unknown> | undefined) ?? {};
  } else {
    const { data: authData } = await userClient(req).auth.getUser();
    const caller = authData.user;
    if (!caller) return json({ error: "unauthorized" }, 401);

    const messageId = body.message_id;
    if (typeof messageId !== "string") {
      return json({ error: "invalid_payload", message: "message_id is required." }, 400);
    }

    const { data: message } = await admin
      .from("messages")
      .select("id, couple_id, sender_id, content")
      .eq("id", messageId)
      .maybeSingle();
    // Only the sender may announce their own message.
    if (!message || message.sender_id !== caller.id) {
      return json({ error: "forbidden" }, 403);
    }

    const { data: members } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", message.couple_id);
    const partner = members?.find((m) => m.user_id !== caller.id);
    if (!partner) return json({ error: "no_partner" }, 409);

    const { data: sender } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", caller.id)
      .maybeSingle();

    recipient = partner.user_id;
    title = sender?.display_name ?? "New message";
    messageBody = message.content ?? "Sent you something.";
    data = { screen: "/chat", message_id: messageId };
  }

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("expo_token")
    .eq("user_id", recipient);

  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, pruned: 0 });
  }

  const pushMessages = tokens.map((t) => ({
    to: t.expo_token,
    title,
    body: messageBody,
    data,
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
