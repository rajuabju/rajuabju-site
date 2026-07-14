# rajuabju.com

A single-page personal link/contact site (Next.js 14, App Router). Dark theme,
social buttons, and a contact form that emails you via SMTP2GO without ever
showing your email address on the page. Contact form is gated behind a
Cloudflare Turnstile CAPTCHA challenge.

## What's here

- `app/page.tsx` — the page content (name, tagline, social links, contact card)
- `app/components/ContactForm.tsx` — the contact form (client-side)
- `app/api/contact/route.ts` — serverless function that verifies Turnstile and sends the email via SMTP2GO
- `app/globals.css` — all styling

## 1. Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 2. Fix the social links

`app/page.tsx` currently points at `facebook.com/rajuabju`,
`instagram.com/rajuabju`, `x.com/rajuabju`, and `reddit.com/u/rajuabju` as
placeholders. Edit the `LINKS` array at the top of that file with your real
profile URLs before deploying.

## 3. Set up the contact form (SMTP2GO)

The form posts to `/api/contact`, which sends mail through the
[SMTP2GO](https://www.smtp2go.com) HTTP API so your inbox address is never
exposed to visitors or present in the page source.

1. Log into your SMTP2GO account.
2. Go to **Sending -> Verified Senders** and add `rajuabju.com` as a sender
   domain. SMTP2GO will give you three CNAME records (return-path, DKIM, and
   click/open tracking) — add them at your DNS host (Cloudflare) and wait for
   the domain to show "Verified".
3. Go to **Sending -> API Keys** and create a new key scoped to just the
   `Emails` permission (`/email/send`) — no need for broader access.
4. You'll add the API key as an environment variable in Vercel in step 4 below
   — don't put real keys in this repo.

The code sends from `noreply@rajuabju.com`. Change the `sender` field in
`app/api/contact/route.ts` if you'd rather use a different address at the
verified domain.

Two environment variables are required (see `.env.example`):

- `SMTP2GO_API_KEY` — the key from step 3
- `CONTACT_TO_EMAIL` — the inbox that should receive messages (your real
  email; it stays server-side only, never shipped to the browser)

## 3b. Set up the CAPTCHA (Cloudflare Turnstile)

The form won't send until the visitor passes a Turnstile challenge, verified
server-side before any email goes out.

1. Go to https://dash.cloudflare.com/?to=/:account/turnstile (free Cloudflare
   account, no credit card needed).
2. Add a site: domain `rajuabju.com` (you can also add `localhost` and your
   `*.vercel.app` preview domain for testing).
3. Choose widget mode — "Managed" is the standard choice (usually resolves
   with a single click, no puzzle).
4. Copy the **Site Key** and **Secret Key** it gives you.

Two more environment variables are required (see `.env.example`):

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — the public site key (safe to expose to
  the browser — that's what `NEXT_PUBLIC_` means)
- `TURNSTILE_SECRET_KEY` — the private secret key (server-side only, used to
  verify the challenge before sending mail)

## 4. Deploy to Vercel

This project has no `.vercel` folder yet, so create the project once:

```bash
npm i -g vercel      # if you don't already have the CLI
vercel login         # opens your browser to authenticate
vercel                # first run: link/create the project, deploy a preview
vercel --prod         # deploy to production
```

Then add the environment variables:

1. In the Vercel dashboard, open the new project -> **Settings -> Environment
   Variables**.
2. Add `SMTP2GO_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
   and `TURNSTILE_SECRET_KEY` (Production + Preview).
3. Redeploy so the function (and the client bundle, for the site key) picks
   them up: `vercel --prod`.

(Alternative: push this folder to a GitHub repo and use Vercel's "Import
Project" flow to connect it — that gives you auto-deploy on every push
instead of running the CLI by hand.)

## 5. DNS (Cloudflare)

`rajuabju.com` is registered at GoDaddy, but GoDaddy's nameservers point to
Cloudflare (`jaxson.ns.cloudflare.com` / `pat.ns.cloudflare.com`), so
Cloudflare is the source of truth for all DNS records. Current records:

- `rajuabju.com` (apex/root, "@"): **A record** -> `216.198.79.1` (Vercel), DNS only
- `www.rajuabju.com`: **CNAME record** -> `a397e77be46d2bca.vercel-dns-017.com` (Vercel), DNS only
- `em<id>.rajuabju.com`, `s<id>._domainkey.rajuabju.com`, `link.rajuabju.com`:
  **CNAME records** for SMTP2GO (return-path, DKIM, click/open tracking)

If Vercel ever shows new target values for the apex/`www` records (it
occasionally rotates them), update the two Vercel-related records in
Cloudflare to match — everything else about the setup stays the same.

## Notes

- The contact form requires name, email, message, and a passed Cloudflare
  Turnstile challenge before it will send. It also has a hidden honeypot
  field and a light per-IP rate limit (3 submissions / 30 minutes).
- No email address appears anywhere in the page's HTML, source, or client
  JavaScript — it only lives in the `CONTACT_TO_EMAIL` server environment
  variable.
