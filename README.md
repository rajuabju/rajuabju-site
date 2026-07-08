# rajuabju.com

A single-page personal link/contact site (Next.js 14, App Router). Dark theme,
social buttons, and a contact form that emails you via Resend without ever
showing your email address on the page.

## What's here

- `app/page.tsx` — the page content (name, tagline, social links, contact card)
- `app/components/ContactForm.tsx` — the contact form (client-side)
- `app/api/contact/route.ts` — serverless function that sends the email via Resend
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

## 3. Set up the contact form (Resend)

The form posts to `/api/contact`, which sends mail through
[Resend](https://resend.com) so your inbox address is never exposed to
visitors or present in the page source.

1. Create a free account at https://resend.com.
2. Go to **API Keys** and create a new key.
3. You do NOT need to verify a domain to get started — the code sends from
   Resend's shared `onboarding@resend.dev` address, which works immediately
   for any recipient on a free account. Later, if you want the "from" address
   to say `@rajuabju.com` instead, verify the domain in Resend (Domains ->
   Add Domain) and add the DNS records it gives you, then update the `from`
   field in `app/api/contact/route.ts`.
4. You'll add the API key as an environment variable in Vercel in step 4 below
   — don't put real keys in this repo.

Two environment variables are required (see `.env.example`):

- `RESEND_API_KEY` — the key from step 2
- `CONTACT_TO_EMAIL` — the inbox that should receive messages (your real
  email; it stays server-side only, never shipped to the browser)

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
2. Add `RESEND_API_KEY` and `CONTACT_TO_EMAIL` (Production + Preview).
3. Redeploy so the function picks them up: `vercel --prod`.

(Alternative: push this folder to a GitHub repo and use Vercel's "Import
Project" flow to connect it — that gives you auto-deploy on every push
instead of running the CLI by hand.)

## 5. Point rajuabju.com at Vercel (GoDaddy DNS)

1. In the Vercel project, go to **Settings -> Domains** and add both
   `rajuabju.com` and `www.rajuabju.com`.
2. Vercel will show you the exact DNS records to add — use whatever it shows
   you as the source of truth, but as of now that's typically:
   - `rajuabju.com` (apex/root, "@"): **A record** -> `76.76.21.21`
   - `www.rajuabju.com`: **CNAME record** -> `cname.vercel-dns.com`
3. Log into GoDaddy -> **My Products -> DNS** for rajuabju.com, and add/edit
   those two records to match. Remove any existing conflicting A or CNAME
   records for `@` and `www` first.
4. DNS changes usually propagate within minutes to a few hours. Vercel's
   Domains tab will show a green checkmark once it verifies.
5. Set `www.rajuabju.com` (or the apex, your call) as the primary domain in
   Vercel and it will auto-redirect the other to it.

## Notes

- The contact form has a hidden honeypot field and a light per-IP rate limit
  (5 submissions / 10 minutes) to cut down on bot spam.
- No email address appears anywhere in the page's HTML, source, or client
  JavaScript — it only lives in the `CONTACT_TO_EMAIL` server environment
  variable.
