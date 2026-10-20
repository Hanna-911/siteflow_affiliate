import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { resolveAffiliate } from "@/lib/resolve-affiliate";

// Runs daily (see vercel.json). Pulls the list of currently-active,
// referred chatbot-builder subscribers from SiteFlow and makes sure this
// month's $7.50 commission exists for each one — whether that's the first
// month (in case the instant webhook ping ever failed to arrive) or the
// fifth month in a row (ongoing recurring commission, since Patreon's
// webhook doesn't cleanly announce "renewed this month" on its own).
//
// Safe to run as often as you like: the (affiliate_id, customer_email,
// period) unique constraint on commission_events means re-running this
// mid-month never creates a duplicate for the same customer+month.

function isAuthorizedCron(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exportUrl = process.env.SITEFLOW_EXPORT_URL;
  const exportSecret = process.env.SITEFLOW_EXPORT_SECRET;
  if (!exportUrl || !exportSecret) {
    return NextResponse.json({ error: "Missing SITEFLOW_EXPORT_URL/SECRET" }, { status: 500 });
  }

  const res = await fetch(exportUrl, {
    headers: { "x-affiliate-export-secret": exportSecret },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `SiteFlow export fetch failed: ${res.status}` },
      { status: 502 }
    );
  }
  const body = await res.json();
  const active: { customerEmail: string; slug: string; updatedAt: string }[] = body.active ?? [];

  const supabase = createAdminClient();
  const period = new Date().toISOString().slice(0, 7);

  let created = 0;
  let skippedUnknownSlug = 0;
  let alreadyExisted = 0;

  for (const entry of active) {
    const customerEmail = entry.customerEmail.trim().toLowerCase();
    const affiliate = await resolveAffiliate(supabase, entry.slug, customerEmail);
    if (!affiliate) {
      skippedUnknownSlug++;
      continue;
    }

    const { error, data } = await supabase
      .from("commission_events")
      .upsert(
        {
          affiliate_id: affiliate.id,
          customer_email: customerEmail,
          period,
          amount_usd: 7.5,
          source: "reconciliation",
          source_event_id: `reconciliation:${affiliate.id}:${customerEmail}:${period}`,
          status: "pending",
        },
        { onConflict: "source_event_id", ignoreDuplicates: true }
      )
      .select();

    // 23505 = this affiliate+customer+month already exists (e.g. created by
    // the instant webhook) — exactly what we want, nothing to add.
    if (error && (error as { code?: string }).code !== "23505") {
      continue; // next daily run retries
    }
    if (data && data.length > 0) created++;
    else alreadyExisted++;
  }

  return NextResponse.json({
    ok: true,
    period,
    checked: active.length,
    commissionsCreated: created,
    alreadyExisted,
    skippedUnknownSlug,
  });
}
