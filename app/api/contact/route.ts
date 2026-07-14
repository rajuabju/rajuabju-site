import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Very small in-memory rate limit per server instance: 3 requests / 30 min / IP.
// Not perfect across serverless invocations, but stops naive bot spam.
const hits = new Map<string, number[]>();
const WINDOW_MS = 30 * 60 * 1000;
const MAX_HITS = 3;

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_HITS;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
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

async function sendViaSmtp2go(opts: {
  apiKey: string;
  to: string;
  name: string;
  email: string;
  message: string;
  ip: string;
}): Promise<{ ok: true } | { ok: false }> {
  const { apiKey, to, name, email, message, ip } = opts;

  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        // rajuabju.com is a verified sender domain in SMTP2GO (SPF/DKIM/return-path
        // CNAMEs live in Cloudflare DNS), so we can send from it directly.
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

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const message = String(body?.message || "").trim();
    const token = String(body?.token || "").trim(); // Turnstile challenge token
    const company = String(body?.company || "").trim(); // honeypot

    // Bots fill hidden fields — silently pretend success.
    if (company) {
      return NextResponse.json({ ok: true });
    }

    if (!name || !email || !message) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (name.length > 100 || email.length > 150 || message.length > 2000) {
      return NextResponse.json({ error: "Input too long." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const isHuman = await verifyTurnstile(token, ip);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Verification failed. Please try the challenge again." },
        { status: 400 }
      );
    }

    const apiKey = process.env.SMTP2GO_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;

    if (!apiKey || !to) {
      console.error("Contact form is missing SMTP2GO_API_KEY or CONTACT_TO_EMAIL env vars.");
      return NextResponse.json(
        { error: "The contact form isn't fully set up yet. Please try again later." },
        { status: 500 }
      );
    }

    const result = await sendViaSmtp2go({ apiKey, to, name, email, message, ip });
    if (!result.ok) {
      return NextResponse.json({ error: "Failed to send. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Unexpected error. Please try again." }, { status: 500 });
  }
}
