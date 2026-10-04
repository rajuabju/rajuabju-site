# rajuabju.com

A single-page personal link/contact site (Next.js 15, App Router, static
export). Dark theme, social buttons, and a contact form that emails you via
SMTP2GO without ever showing your email address on the page. The contact form
is gated behind a Cloudflare Turnstile CAPTCHA challenge.

Hosted on **Cloudflare Pages** (project `rajuabju-site`), built from this repo
on every push to `main`.

## What's here

- `app/page.tsx`: the page content (name, tagline, social links, contact card)
- `app/components/ContactForm.tsx`: the contact form (client-side)
- `functions/api/contact.js`: Cloudflare Pages Function that verifies Turnstile
  and sends the email via SMTP2GO
- `app/globals.css`: all styling
- `next.config.js`: `output: "export"` (static HTML in `out/`), unoptimized images
- `wrangler.toml`: Pages config (`pages_build_output_dir = "out"`)

## 1. Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. `npm run dev` serves the page only; the contact
form's `/api/contact` is a Pages Function, so to exercise it locally build and
run it with wrangler:

```bash
npx next build
npx wrangler pages dev out
```

(`npm run start` / `next start` does not work with a static export.)

## 2. Contact form (SMTP2GO)

The form posts to `/api/contact`, which sends mail through the
[SMTP2GO](https://www.smtp2go.com) HTTP API, so your inbox address is never
exposed to visitors or present in the page source.

- `rajuabju.com` is a Verified Sender domain in SMTP2GO; its three CNAME
  records (return-path, DKIM, click/open tracking) live in Cloudflare DNS.
- Mail is sent from `noreply@rajuabju.com` (the `sender` field in
  `functions/api/contact.js`).
- The API key is scoped to the `Emails` permission (`/email/send`) only.

## 3. CAPTCHA (Cloudflare Turnstile)

The form won't send until the visitor passes a Turnstile challenge, verified
server-side in the Pages Function before any email goes out. Manage the widget
at https://dash.cloudflare.com/?to=/:account/turnstile (domain `rajuabju.com`;
add `localhost` for local testing).

## 4. Environment variables

See `.env.example`. In Cloudflare: **Workers & Pages -> rajuabju-site ->
Settings -> Variables and Secrets** (Production, and Preview if used).

| Variable | Where it's used | Secret? |
|---|---|---|
| `SMTP2GO_API_KEY` | Pages Function | yes |
| `CONTACT_TO_EMAIL` | Pages Function: the inbox that receives messages | yes |
| `TURNSTILE_SECRET_KEY` | Pages Function: verifies the challenge | yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build time, baked into the page (public) | no; also in `.env.production` |

Because `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read at build time, changing it
needs a rebuild (push a commit or retry the deployment).

## 5. Deploy (Cloudflare Pages)

The `rajuabju-site` Pages project is connected to this GitHub repo. Every push
to `main` triggers a production build: framework preset **Next.js (Static HTML
Export)**, build command `npx next build`, output directory `out`. There is no
GitHub Actions workflow; the build runs on Cloudflare.

## 6. DNS (Cloudflare)

`rajuabju.com` is registered at GoDaddy, with GoDaddy's nameservers pointing to
Cloudflare, so Cloudflare is the source of truth for DNS:

- `rajuabju.com` (apex) and `www.rajuabju.com`: CNAME -> `rajuabju-site.pages.dev` (proxied)
- `em<id>`, `s<id>._domainkey`, `link`: CNAMEs for SMTP2GO (DNS only)
- Other subdomains (`admin`, `dash`, `family`, `finance`, `home`, `hub`,
  `life`, `medical`, `purchases`, `trips`) belong to the family dashboards in
  the `soroudi-dash` repo; don't change them from here.

## Notes

- The contact form requires name, email, message, and a passed Turnstile
  challenge. It also has a hidden honeypot field and a light per-IP rate limit
  (3 submissions / 30 minutes).
- No email address appears anywhere in the page's HTML, source, or client
  JavaScript; it only lives in the `CONTACT_TO_EMAIL` Pages secret.
- Lint: ESLint is not set up (`next lint` is deprecated in Next 15.5). Adding
  `eslint-config-next` currently pulls in a dev dependency with an unpatched
  advisory, so it's left out for now.
