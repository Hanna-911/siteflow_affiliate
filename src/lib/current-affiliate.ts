import { createClient } from "@/lib/supabase/server";

export type AffiliateRow = {
  id: string;
  email: string;
  full_name: string | null;
  slug: string;
  marketing_platform: string | null;
  role: "affiliate" | "admin";
  status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
  approved_at: string | null;
};

// Returns the logged-in user's own affiliate row, or null if not logged in.
// Relies on RLS ("affiliates read own row") so this is safe to call from
// any server component without a service-role client.
export async function getCurrentAffiliate(): Promise<AffiliateRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("affiliates")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as AffiliateRow | null) ?? null;
}
