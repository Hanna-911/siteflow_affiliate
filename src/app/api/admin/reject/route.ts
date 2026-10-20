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

  const { affiliateId } = await request.json();
  if (typeof affiliateId !== "string") {
    return NextResponse.json({ error: "Missing affiliateId" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("affiliates")
    .update({ status: "rejected" })
    .eq("id", affiliateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
