import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { resolveAffiliate } from "@/lib/resolve-affiliate";

// Receives an instant ping from SiteFlow's Patreon webhook the moment a
// referred customer's pledge for the chatbot builder goes active. See
// AFFILIATE_WEBHOOK_URL / AFFILIATE_WEBHOOK_SECRET in SiteFlow's
// src/app/api/patreon/webhook/route.ts for the sender side.
//
// Body: { slug, customerEmail, occurredAt, sourceEventId }
//
// This only handles the FIRST purchase in real time. Ongoing monthly
// renewals for the same customer are caught by /api/cron/reconcile-renewals
// polling SiteFlow daily, since Patreon's webhook doesn't reliably signal
// "this month's charge succeeded" on its own.

function isAuthorized(request: Request) {
  const provided = request.headers.get("x-siteflow-webhook-secret");
  const expected = process.env.SITEFLOW_WEBHOOK_SECRET;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, customerEmail: rawEmail, occurredAt, sourceEventId } = await request.json();
  if (!slug || !rawEmail || !sourceEventId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const customerEmail = String(rawEmail).trim().toLowerCase();

  const supabase = createAdminClient();

  const affiliate = await resolveAffiliate(supabase, String(slug), customerEmail);
  if (!affiliate) {
    // Unknown / unapproved affiliate, or self-purchase — nothing to credit.
    // Still 200 so SiteFlow doesn't retry forever on something that will
    // never resolve.
    return NextResponse.json({ ok: true, note: "No matching approved affiliate" });
  }

  const period = (occurredAt ? new Date(occurredAt) : new Date()).toISOString().slice(0, 7);

  const { error } = await supabase.from("commission_events").upsert(
    {
      affiliate_id: affiliate.id,
      customer_email: customerEmail,
      period,
      amount_usd: 7.5,
      source: "webhook",
      source_event_id: sourceEventId,
      status: "pending",
    },
    { onConflict: "source_event_id", ignoreDuplicates: true }
  );

  if (error) {
    // 23505 = unique_violation: same affiliate+customer+month already
    // recorded (e.g. a tier update later in the same month). Not a new sale.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, note: "Already recorded for this period" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
