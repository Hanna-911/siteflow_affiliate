import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedAffiliate = { id: string; email: string; status: string };

// Works out which affiliate should be credited for a customer.
// Order matters:
//  1. If this customer was already attributed to someone, that affiliate
//     keeps them forever (first-touch).
//  2. Otherwise match the slug from the customer's signup link — current
//     slug first, then any OLD slug the affiliate used before editing their
//     link (so old links keep earning).
// Returns null when there is nobody to credit (unknown slug, affiliate not
// approved, or the "customer" is the affiliate themselves).
export async function resolveAffiliate(
  supabase: SupabaseClient,
  slug: string,
  customerEmail: string
): Promise<ResolvedAffiliate | null> {
  const email = customerEmail.trim().toLowerCase();
  let affiliateId: string | null = null;

  const { data: existing } = await supabase
    .from("referrals")
    .select("affiliate_id")
    .eq("customer_email", email)
    .maybeSingle();
  if (existing) affiliateId = existing.affiliate_id;

  if (!affiliateId) {
    const cleanSlug = slug.trim().toLowerCase();
    const { data: byCurrent } = await supabase
      .from("affiliates")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();
    if (byCurrent) {
      affiliateId = byCurrent.id;
    } else {
      const { data: byOld } = await supabase
        .from("affiliate_old_slugs")
        .select("affiliate_id")
        .eq("slug", cleanSlug)
        .maybeSingle();
      if (byOld) affiliateId = byOld.affiliate_id;
    }
  }
  if (!affiliateId) return null;

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, email, status")
    .eq("id", affiliateId)
    .maybeSingle();
  if (!affiliate || affiliate.status !== "approved") return null;

  // No paying yourself a commission for buying through your own link.
  if (affiliate.email.trim().toLowerCase() === email) return null;

  if (!existing) {
    await supabase
      .from("referrals")
      .upsert(
        { affiliate_id: affiliate.id, customer_email: email },
        { onConflict: "customer_email", ignoreDuplicates: true }
      );
  }

  return affiliate as ResolvedAffiliate;
}
