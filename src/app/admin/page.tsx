import { getCurrentAffiliate } from "@/lib/current-affiliate";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import Link from "next/link";
import ApprovalButtons from "@/components/approval-buttons";

export default async function AdminPage() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) redirect("/login");
  if (affiliate.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("affiliates")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen">
      <DashboardNav affiliate={affiliate} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pending approvals</h1>
          <Link href="/admin/affiliates" className="text-sm text-brand underline">
            View all affiliates →
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {(pending ?? []).length === 0 && (
            <p className="text-slate">No pending applications right now.</p>
          )}
          {(pending ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-2xl border border-line bg-white p-5"
            >
              <div>
                <p className="font-semibold">{a.full_name ?? a.email}</p>
                <p className="text-sm text-slate">{a.email}</p>
                {a.marketing_platform && (
                  <p className="text-sm text-slate">Platform: {a.marketing_platform}</p>
                )}
                <p className="text-xs text-slate">
                  Applied {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <ApprovalButtons affiliateId={a.id} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
