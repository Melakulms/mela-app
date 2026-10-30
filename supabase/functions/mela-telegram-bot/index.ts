import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// MELA staging Telegram backend. No payment acceptance, approval, or account linking.
// Secrets must be supplied in Supabase Edge Functions > Secrets, never in code.
const STAGING_URL = "https://tungqfmypuwzeyrtaseh.supabase.co";
const BOT_USERNAME = "mela_edu_bot";
const FUNCTION_SLUG = "mela-telegram-bot";
const encoder = new TextEncoder();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function secureEqual(provided: string, expected: string): boolean {
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function credentials() {
  const token = Deno.env.get("MELA_TELEGRAM_BOT_TOKEN") || "";
  const secret = Deno.env.get("MELA_TELEGRAM_WEBHOOK_SECRET") || "";
  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  return {
    token,
    secret,
    safeProject: projectUrl === STAGING_URL,
    configured: /^[0-9]{5,}:[A-Za-z0-9_-]{20,}$/.test(token)
      && /^[A-Za-z0-9_-]{32,256}$/.test(secret)
      && projectUrl === STAGING_URL,
  };
}

async function telegramCall(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Telegram API HTTP " + response.status);
  const data = await response.json();
  if (!data || data.ok !== true) throw new Error("Telegram API returned an error");
  return data.result;
}

function replyFor(text: string): string {
  const command = text.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
  switch (command) {
    case "/start":
      return "Welcome to MELA Education! 🇪🇹\n\nThis bot is connected to MELA's staging environment for testing. Free education continues in the MELA app.\n\nUse /help to see what I can do. Please do not share banking PINs, passwords, or payment screenshots here.";
    case "/help":
      return "MELA Education Bot (test mode)\n\n/start — Welcome\n/help — Commands\n/pay — Payment availability\n/verify — Payment verification guidance\n/status — Account and payment status guidance\n/privacy — Privacy notice\n\nPayment collection and automated approval are disabled.";
    case "/pay":
      return "MELA payment collection is currently disabled while we test security and settlement verification. There is no payment account or checkout available through this bot. Please do not send money based on Telegram messages.";
    case "/verify":
      return "Payment verification is NOT active yet. A receipt or transaction reference alone does not prove settlement. Please do not submit payment references, screenshots, PINs or passwords here. Only confirmed receipts from a trusted provider or authorized MFA-protected review may activate paid services.";
    case "/status":
      return "This Telegram chat is not linked to your MELA account, so I cannot show private subscriptions or payment records. Check your signed-in MELA account. Payment verification remains disabled in this test bot.";
    case "/privacy":
      return "This bot responds to commands in private chats. It does not collect payment details, identity documents, or MELA passwords. Do not send sensitive information here. Private account linking and consent must be completed before enabling personalized services.";
    default:
      return "MELA staging bot is in test mode. Type /help to see available commands. Please do not send payment screenshots or account credentials.";
  }
}

export async function handler(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  const cfg = credentials();
  if (!cfg.safeProject) return json({ ok: false, error: "staging_project_mismatch" }, 503);

  if (req.method === "GET" && (path.endsWith("/" + FUNCTION_SLUG) || path.endsWith("/" + FUNCTION_SLUG + "/health"))) {
    return json({
      ok: true, service: "MELA Telegram staging backend", bot: "@" + BOT_USERNAME,
      configured: cfg.configured, payments_enabled: false,
      supported_commands: ["/start", "/help", "/pay", "/verify", "/status", "/privacy"],
    });
  }

  if (req.method === "POST" && (path.endsWith("/" + FUNCTION_SLUG + "/setup") || (path.endsWith("/" + FUNCTION_SLUG) && req.headers.has("x-mela-telegram-setup-secret")))) {
    if (!cfg.configured) return json({ ok: false, error: "bot_secrets_not_configured" }, 503);
    const setupSecret = req.headers.get("x-mela-telegram-setup-secret") || "";
    if (!secureEqual(setupSecret, cfg.secret)) return json({ ok: false, error: "unauthorized" }, 401);
    try {
      const me = await telegramCall(cfg.token, "getMe", {});
      if (String(me.username || "").toLowerCase() !== BOT_USERNAME) {
        return json({ ok: false, error: "bot_username_mismatch" }, 409);
      }
      // Fixed endpoint: callers cannot choose a webhook destination.
      const webhookUrl = STAGING_URL + "/functions/v1/" + FUNCTION_SLUG;
      await telegramCall(cfg.token, "setWebhook", {
        url: webhookUrl, secret_token: cfg.secret,
        allowed_updates: ["message"], max_connections: 2, drop_pending_updates: false,
      });
      return json({ ok: true, webhook_registered: true, bot: "@" + BOT_USERNAME });
    } catch (e) {
      console.error("MELA Telegram setup failed:", e instanceof Error ? e.message : "unknown");
      return json({ ok: false, error: "telegram_setup_failed" }, 502);
    }
  }

  if (req.method === "POST" && path.endsWith("/" + FUNCTION_SLUG)) {
    if (!cfg.configured) return json({ ok: false, error: "bot_secrets_not_configured" }, 503);
    const providedSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!secureEqual(providedSecret, cfg.secret)) return json({ ok: false, error: "unauthorized" }, 401);
    if ((req.headers.get("content-length") || "").match(/^\d+$/)
        && Number(req.headers.get("content-length")) > 16384) {
      return json({ ok: false, error: "payload_too_large" }, 413);
    }
    let update: any;
    try {
      const raw = await req.text();
      if (raw.length > 16384) return json({ ok: false, error: "payload_too_large" }, 413);
      update = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    const message = update?.message;
    const chat = message?.chat;
    // Never process group chats, media attachments, callbacks, or someone else's identity.
    if (!Number.isSafeInteger(update?.update_id)
        || chat?.type !== "private"
        || !Number.isSafeInteger(chat?.id)
        || message?.from?.id !== chat.id
        || message?.from?.is_bot) {
      return json({ ok: true, ignored: true });
    }

    const answer = typeof message.text === "string" && message.text.length <= 4096
      ? replyFor(message.text)
      : "MELA cannot process attachments or sensitive documents through this test bot. Send /help for commands.";
    try {
      await telegramCall(cfg.token, "sendMessage", { chat_id: chat.id, text: answer, protect_content: true });
      return json({ ok: true });
    } catch (e) {
      console.error("MELA Telegram response failed:", e instanceof Error ? e.message : "unknown");
      return json({ ok: false, error: "telegram_delivery_failed" }, 502);
    }
  }

  return json({ ok: false, error: "not_found" }, 404);
}

Deno.serve(handler);
