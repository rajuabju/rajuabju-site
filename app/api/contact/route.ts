import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Very small in-memory rate limit per server instance: 5 requests / 10 min / IP.
// Not perfect across serverless invocations, but stops naive bot spam.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_HITS;
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

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_TO_EMAIL;

    if (!apiKey || !to) {
      console.error("Contact form is missing RESEND_API_KEY or CONTACT_TO_EMAIL env vars.");
      return NextResponse.json(
        { error: "The contact form isn't fully set up yet. Please try again later." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      // onboarding@resend.dev works without verifying a domain on Resend.
      // Once rajuabju.com is verified in Resend, swap this to something like
      // "rajuabju.com <hello@rajuabju.com>".
      from: "rajuabju.com contact form <onboarding@resend.dev>",
      to,
      reply_to: email,
      subject: `New message from ${name} via rajuabju.com`,
      text: `${message}\n\n---\nFrom: ${name} <${email}>\nIP: ${ip}`,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Failed to send. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return NextResponse.json({ error: "Unexpected error. Please try again." }, { status: 500 });
  }
}