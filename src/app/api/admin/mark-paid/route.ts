import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: me } = await supabase
    .from("affiliates")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" || me?.status !== "approved") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { affiliateId, period } = await request.json();
  if (!affiliateId || !period) {
    return NextResponse.json({ error: "Missing affiliateId or period" }, { status: 400 });
  }

  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "Bad period" }, { status: 400 });
  }

  // Marks this affiliate's still-pending commissions for that month as paid.
  // Run this after you've actually sent the money via their payout method —
  // this button doesn't move any money itself.
  const { error, count } = await createAdminClient()
    .from("commission_events")
    .update({ status: "paid" }, { count: "exact" })
    .eq("affiliate_id", affiliateId)
    .eq("period", period)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: count });
}
