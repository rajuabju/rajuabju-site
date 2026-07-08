"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Script from "next/script";

type Status = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    turnstile?: {
      reset: (widgetId?: string) => void;
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    };
    onTurnstileVerified?: (token: string) => void;
    onTurnstileExpired?: () => void;
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.onTurnstileVerified = (token: string) => setTurnstileToken(token);
    window.onTurnstileExpired = () => setTurnstileToken("");

    return () => {
      delete window.onTurnstileVerified;
      delete window.onTurnstileExpired;
    };
  }, []);

  function resetTurnstile() {
    setTurnstileToken("");
    if (window.turnstile && widgetRef.current) {
      window.turnstile.reset();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!turnstileToken) {
      setStatus("error");
      setErrorMessage("Please complete the verification challenge before sending.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      message: String(data.get("message") || ""),
      token: turnstileToken,
      // honeypot field — real visitors never fill this in
      company: String(data.get("company") || ""),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      // Turnstile tokens are single-use — reset the widget after every attempt.
      resetTurnstile();
    }
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={100} />
        </div>

        <div>
          <label htmlFor="email">Your email</label>
          <input id="email" name="email" type="email" required maxLength={150} />
        </div>

        <div>
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={4} required maxLength={2000} />
        </div>

        {/* Honeypot: hidden from real users, bots tend to fill every field */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {TURNSTILE_SITE_KEY ? (
          <div
            ref={widgetRef}
            className="cf-turnstile"
            data-sitekey={TURNSTILE_SITE_KEY}
            data-callback="onTurnstileVerified"
            data-expired-callback="onTurnstileExpired"
            data-theme="dark"
          />
        ) : (
          <p className="status error">
            Verification widget isn&rsquo;t configured yet (missing
            NEXT_PUBLIC_TURNSTILE_SITE_KEY).
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting" || !turnstileToken}
        >
          {status === "submitting" ? "Sending..." : "Send message"}
        </button>

        {status === "success" && (
          <p className="status success">Thanks — your message is on its way.</p>
        )}
        {status === "error" && <p className="status error">{errorMessage}</p>}
      </form>
    </>
  );
}
