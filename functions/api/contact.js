// rajuabju.com — contact form handler (Cloudflare Pages Function).
// POST /api/contact — Turnstile verify + rate limit, then SMTP2GO.
// Secrets: TURNSTILE_SECRET_KEY, SMTP2GO_API_KEY, CONTACT_TO_EMAIL

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limit per isolate: 3 requests / 30 min / IP (a deterrent).
const hits = new Map();
const WINDOW_MS = 30 * 60 * 1000;
const MAX_HITS = 3;

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_HITS;
}

async function verifyTurnstile(token, ip, secret) {
  if (!secret) {
    console.error("Contact form is missing TURNSTILE_SECRET_KEY env var.");
    return false;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error("Turnstile verification request failed:", err);
    return false;
  }
}

async function sendViaSmtp2go({ apiKey, to, name, email, message, ip }) {
  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        sender: "rajuabju.com contact form <noreply@rajuabju.com>",
        to: [to],
        subject: `New message from ${name} via rajuabju.com`,
        text_body: `${message}\n\n---\nFrom: ${name} <${email}>\nIP: ${ip}`,
        custom_headers: [{ header: "Reply-To", value: email }],
      }),
    });
    const data = await res.json().catch(() => null);
    const succeeded = data?.data?.succeeded ?? 0;
    const failed = data?.data?.failed ?? 0;
    if (!res.ok || succeeded < 1 || failed > 0) {
      console.error("SMTP2GO error:", res.status, JSON.stringify(data));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("SMTP2GO request failed:", err);
    return { ok: false };
  }
}

const json = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    if (rateLimited(ip)) {
      return json({ error: "Too many requests. Try again later." }, 429);
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const message = String(body?.message || "").trim();
    const token = String(body?.token || "").trim(); // Turnstile challenge token
    const company = String(body?.company || "").trim(); // honeypot

    // Bots fill hidden fields — silently pretend success.
    if (company) return json({ ok: true });

    if (!name || !email || !message) {
      return json({ error: "All fields are required." }, 400);
    }
    if (name.length > 100 || email.length > 150 || message.length > 2000) {
      return json({ error: "Input too long." }, 400);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const isHuman = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
    if (!isHuman) {
      return json({ error: "Verification failed. Please try the challenge again." }, 400);
    }

    const apiKey = env.SMTP2GO_API_KEY;
    const to = env.CONTACT_TO_EMAIL;
    if (!apiKey || !to) {
      console.error("Contact form is missing SMTP2GO_API_KEY or CONTACT_TO_EMAIL env vars.");
      return json({ error: "The contact form isn't fully set up yet. Please try again later." }, 500);
    }

    const result = await sendViaSmtp2go({ apiKey, to, name, email, message, ip });
    if (!result.ok) {
      return json({ error: "Failed to send. Please try again." }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
}
