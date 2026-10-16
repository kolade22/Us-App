// issue-daily-question: issues eligible question instances.
// - Service-role callers (scheduled invocation / pg_cron bridge): runs for
//   every member of every active couple, or a specific couple+recipient.
// - Authenticated members: may request their own couple's recipients (the
//   RPC enforces membership and the 48-hour eligibility window).
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, isServiceRole, userClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { couple_id?: unknown; recipient_id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for the service-role sweep
  }

  const hasTargets =
    typeof body.couple_id === "string" && typeof body.recipient_id === "string";

  if (isServiceRole(req)) {
    const admin = adminClient();
    if (hasTargets) {
      const { data, error } = await admin.rpc("issue_daily_question", {
        p_couple_id: body.couple_id,
        p_recipient_id: body.recipient_id,
      });
      if (error) return json({ error: "issue_failed", message: error.message }, 400);
      return json({ question_instance_id: data });
    }
    const { data, error } = await admin.rpc("issue_scheduled_questions");
    if (error) return json({ error: "sweep_failed", message: error.message }, 400);
    return json({ issued: data });
  }

  const client = userClient(req);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  if (!hasTargets) {
    return json({ error: "missing_targets", message: "couple_id and recipient_id are required." }, 400);
  }

  const { data, error } = await client.rpc("issue_daily_question", {
    p_couple_id: body.couple_id,
    p_recipient_id: body.recipient_id,
  });
  if (error) {
    if (error.message.includes("not a couple member")) {
      return json({ error: "forbidden", message: "You are not a member of this couple." }, 403);
    }
    return json({ error: "issue_failed", message: error.message }, 400);
  }
  return json({ question_instance_id: data });
});
