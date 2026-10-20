import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json();
  const activeMethod = body.activeMethod;
  if (!["paypal", "bank", "payoneer"].includes(activeMethod)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const { error } = await supabase.from("payout_methods").upsert({
    affiliate_id: user.id,
    active_method: activeMethod,
    paypal_email: body.paypalEmail || null,
    payoneer_email: body.payoneerEmail || null,
    bank_account_holder: body.bankAccountHolder || null,
    bank_account_number: body.bankAccountNumber || null,
    bank_routing_number: body.bankRoutingNumber || null,
    bank_name: body.bankName || null,
    bank_country: body.bankCountry || null,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
