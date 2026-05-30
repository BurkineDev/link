This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Create a local environment file with the app, Supabase, Stripe, and Anthropic values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Required by the free AI tools under /api/outils/* (product descriptions, WhatsApp messages)
ANTHROPIC_API_KEY=sk-ant-...
# Distributed rate limiting + global budget cap for the AI tools (Upstash Redis).
# Provision via the Vercel Marketplace (Upstash) and copy the REST credentials.
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

The `/api/outils/*` endpoints are public and unauthenticated. They are
protected in three layers (see `src/lib/rate-limit.ts`):

- in-memory per-IP burst (instant, per-instance);
- distributed per-IP limits via Upstash — 10/min and 30/day;
- a **global daily budget ceiling of 300 generations/day** shared across all
  IPs and tools — the real guard on the Anthropic spend.

If the Upstash variables are absent (e.g. local dev) only the in-memory layer
applies, so **production must set them** for the distributed limits and budget
cap to take effect.

Stripe Checkout redirects back to `/checkout/success?session_id=...`. Configure
the Stripe webhook URL as `/api/webhooks/stripe` and subscribe to
`checkout.session.completed` and `checkout.session.expired`.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
