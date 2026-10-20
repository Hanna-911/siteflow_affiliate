import { getCurrentAffiliate } from "@/lib/current-affiliate";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import CopyLinkButton from "@/components/copy-link-button";

export default async function DashboardPage() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) redirect("/login");

  const supabase = await createClient();

  const [{ count: referralCount }, { data: commissions }] = await Promise.all([
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id),
    supabase
      .from("commission_events")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("period", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const rows = commissions ?? [];
  const pendingTotal = rows
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.amount_usd), 0);
  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + Number(r.amount_usd), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = rows.filter((r) => r.period === thisMonth).length;

  const siteflowUrl = process.env.NEXT_PUBLIC_SITEFLOW_URL ?? "https://siteflow-omega.vercel.app";
  const referralLink = `${siteflowUrl}/?ref=${affiliate.slug}`;

  return (
    <div className="min-h-screen">
      <DashboardNav affiliate={affiliate} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Welcome, {affiliate.full_name ?? affiliate.email}</h1>

        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <p className="text-sm font-semibold text-slate">Your referral link</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-canvas px-3 py-2 text-sm">{referralLink}</code>
            <CopyLinkButton link={referralLink} />
            <a href="/dashboard/link" className="text-sm text-brand underline">
              Edit link
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <StatCard label="Customers who bought" value={String(referralCount ?? 0)} />
          <StatCard label="Commission this month" value={`$${(thisMonthCount * 7.5).toFixed(2)}`} />
          <StatCard label="Pending payout" value={`$${pendingTotal.toFixed(2)}`} />
        </div>

        <p className="mt-2 text-sm text-slate">
          Lifetime paid out: <strong>${paidTotal.toFixed(2)}</strong>
        </p>

        <h2 className="mt-10 text-lg font-bold">Commission history</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-slate">
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate">
                    No commissions yet — they&apos;ll show up here once someone buys
                    through your link.
                  </td>
                </tr>
              )}
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{r.period}</td>
                  <td className="px-4 py-3">{maskEmail(r.customer_email)}</td>
                  <td className="px-4 py-3">${Number(r.amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "paid"
                          ? "rounded-full bg-flow-bg px-2 py-0.5 text-xs font-semibold text-flow"
                          : "rounded-full bg-brand-bg px-2 py-0.5 text-xs font-semibold text-brand"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}
