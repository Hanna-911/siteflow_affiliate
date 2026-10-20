import { getCurrentAffiliate } from "@/lib/current-affiliate";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import MarkPaidButton from "@/components/mark-paid-button";

export default async function AdminAffiliatesPage() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) redirect("/login");
  if (affiliate.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: affiliates }, { data: commissions }, { data: payoutMethods }] = await Promise.all([
    supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
    supabase.from("commission_events").select("*"),
    supabase.from("payout_methods").select("*"),
  ]);

  const methodByAffiliate = new Map((payoutMethods ?? []).map((p) => [p.affiliate_id, p]));

  return (
    <div className="min-h-screen">
      <DashboardNav affiliate={affiliate} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold">All affiliates</h1>

        <div className="mt-6 space-y-4">
          {(affiliates ?? []).map((a) => {
            const rows = (commissions ?? []).filter((c) => c.affiliate_id === a.id);
            const pending = rows.filter((c) => c.status === "pending");
            const pendingTotal = pending.reduce((s, c) => s + Number(c.amount_usd), 0);
            // One "mark paid" button per month that still has unpaid
            // commissions — so at month-end you can pay last month even
            // after the calendar has rolled over.
            const pendingByPeriod = new Map<string, number>();
            for (const c of pending) {
              pendingByPeriod.set(c.period, (pendingByPeriod.get(c.period) ?? 0) + Number(c.amount_usd));
            }
            const periods = Array.from(pendingByPeriod.keys()).sort();
            const payout = methodByAffiliate.get(a.id);

            return (
              <div key={a.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {a.full_name ?? a.email}{" "}
                      <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs capitalize text-slate">
                        {a.status}
                      </span>
                    </p>
                    <p className="text-sm text-slate">{a.email} · /?ref={a.slug}</p>
                    {payout ? (
                      <p className="mt-1 text-sm text-slate">
                        Pays via <strong className="capitalize">{payout.active_method}</strong>:{" "}
                        {payout.active_method === "paypal" && payout.paypal_email}
                        {payout.active_method === "payoneer" && payout.payoneer_email}
                        {payout.active_method === "bank" &&
                          `${payout.bank_account_holder} · ${payout.bank_name} (${payout.bank_country}) · acct ${payout.bank_account_number} · routing/SWIFT ${payout.bank_routing_number}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate">No payout method on file yet.</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate">Pending total</p>
                    <p className="text-xl font-bold">${pendingTotal.toFixed(2)}</p>
                    {periods.map((period) => (
                      <div key={period}>
                        <MarkPaidButton
                          affiliateId={a.id}
                          period={period}
                          amount={pendingByPeriod.get(period) ?? 0}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
