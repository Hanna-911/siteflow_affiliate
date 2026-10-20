# SiteFlow Affiliates

A private, invite-only affiliate tracking site for SiteFlow. Separate
GitHub repo, separate Supabase project, separate Vercel project — this app
never touches SiteFlow's database directly. The two apps talk over two
small HTTP endpoints (see "How the two sites connect" below).

## What this does

- Anyone can request an account at `/register`, but they land in "pending"
  and can't see anything until an admin approves them at `/admin`.
- Once approved, an affiliate gets a default referral link
  (`https://<siteflow-domain>/?ref=<their-slug>`), which they can edit.
- When someone buys SiteFlow's Chatbot builder plan after clicking that
  link, this site detects it automatically and logs a **$7.50** commission
  for that affiliate — the first month instantly (via a webhook SiteFlow
  sends), and every month after that they stay subscribed (via a daily
  reconciliation job, see below).
- Affiliates set a payout method — PayPal, bank details, or Payoneer — from
  `/dashboard/payment`. You pay them manually each month, then click
  "mark paid" in `/admin/affiliates` to clear their pending balance.

## 1. Create the GitHub repo

```bash
cd siteflow-affiliates
git init
git add .
git commit -m "Initial commit — SiteFlow affiliate tracking site"
gh repo create siteflow-affiliates --private --source=. --push
# (or create an empty private repo on github.com and `git remote add origin ...` + push)
```

## 2. Create a new Supabase project

1. https://supabase.com/dashboard → New project. Pick any name/region —
   this is a completely separate project from SiteFlow's.
2. Once it's provisioned, open **SQL Editor** and run the entire contents
   of `supabase/schema.sql` from this repo. That creates every table,
   RLS policy, and the signup trigger.
3. Go to **Project settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret —
     it bypasses every RLS policy)
4. Go to **Authentication → URL configuration** and add your eventual
   Vercel URL (e.g. `https://siteflow-affiliates.vercel.app`) plus
   `http://localhost:3000` to the redirect allow-list, so email
   confirmation links work.

## 3. Deploy to a new Vercel project

1. https://vercel.com/new → import the `siteflow-affiliates` GitHub repo.
2. Add all the environment variables from `.env.example` in
   **Project settings → Environment variables**. You'll come back and fill
   in `SITEFLOW_WEBHOOK_SECRET` / `SITEFLOW_EXPORT_SECRET` / `CRON_SECRET`
   with values you make up yourself in step 4 — just make sure the *same*
   string is used on both sides.
3. Deploy. `vercel.json` already configures the daily reconciliation cron
   (runs at 04:00 UTC) — Vercel's Hobby plan allows cron jobs that run once a day, which is
   exactly what this uses.

## 4. Connect it to SiteFlow

In **SiteFlow's own** repo/Vercel project (not this one):

1. Run `supabase/schema-affiliate-referral.sql` (added to that repo) in
   SiteFlow's Supabase SQL editor. This adds the `referred_by_slug` column
   to `profiles` and updates the signup trigger to store it.
2. Add three env vars to SiteFlow's Vercel project, matching what you put
   in this project's env vars:
   - `AFFILIATE_WEBHOOK_URL` = `https://<this-site>/api/webhooks/siteflow-purchase`
   - `AFFILIATE_WEBHOOK_SECRET` = same value as `SITEFLOW_WEBHOOK_SECRET` here
   - `AFFILIATE_EXPORT_SECRET` = same value as `SITEFLOW_EXPORT_SECRET` here
3. Redeploy SiteFlow so `middleware.ts`, the updated `/register` page, and
   the updated Patreon webhook route go live.

## 5. Create your own admin account

Register normally at `/register` on this site with your own email. Then,
in **this project's** Supabase SQL editor, run:

```sql
update public.affiliates
set role = 'admin', status = 'approved', approved_at = now()
where email = 'you@example.com';
```

Log back in and you'll see the **Admin** link in the nav.

## 6. Test the whole loop end to end

1. As admin, approve a test affiliate account (or use your own second test
   account) and note its referral link, e.g.
   `https://siteflow-omega.vercel.app/?ref=maria-4k2p`.
2. Visit that link in an incognito window, then register a brand-new
   SiteFlow account. Check SiteFlow's `profiles` table — the new row
   should have `referred_by_slug` set to `maria-4k2p`.
3. Use SiteFlow's existing `/api/patreon/test-simulate` route to simulate a
   "Chatbot Builder" pledge for that same test email (see the comment at
   the top of that file for the exact URL format).
4. Check this site's `commission_events` table (or the affiliate's own
   `/dashboard`) — a `$7.50` pending row for the current month should show
   up right away.
5. To test the recurring path, manually hit
   `GET /api/cron/reconcile-renewals` with the `Authorization: Bearer
   <CRON_SECRET>` header — it should find the same still-active test
   subscription and confirm the row already exists (or create it, if you
   skipped step 3).

## Things worth knowing before this handles real money

- **Bank details are stored as plain text columns**, not encrypted at the
  column level. For a handful of affiliates this is a normal small-business
  risk tradeoff, but before this scales, consider Supabase Vault (or
  encrypting `bank_account_number` at the application layer) so a database
  leak doesn't expose account numbers directly.
- **Attribution is first-touch and permanent**: the first affiliate whose
  link a customer used owns that customer's commissions forever (enforced
  by the `unique(customer_email)` constraint on `referrals`). If two
  affiliates both promote the same lead, only the first link clicked (that
  led to a completed signup) gets credit.
- **Recurring detection is approximate by design.** Patreon's webhook
  tells you about pledge *changes* (created/updated/canceled), not "this
  month's charge succeeded" the way Stripe's `invoice.paid` would. The
  daily reconciliation job (`/api/cron/reconcile-renewals`) works around
  this by checking "is this customer still active today?" once a day and
  crediting the current month if so — which is accurate in practice, but
  isn't tied to the exact instant Patreon actually charges the card.
- **Editing a link is safe**: old slugs are remembered (`affiliate_old_slugs`), so customers who signed up via an old link still earn the affiliate their monthly commission.
- **Self-referral is blocked**: an affiliate buying through their own link earns nothing.
- **Refunds/chargebacks are not clawed back automatically** — check Patreon before paying out.
- **Payouts are manual.** This system tracks who's owed what; it doesn't
  move any money. You still log into PayPal/your bank/Payoneer yourself
  each month and send it, then click "mark paid" here to clear the ledger.
- **The very first admin has to be promoted by hand** (step 5) — there's
  no separate admin-signup flow, by design, so nobody can grant themselves
  admin through the UI.
