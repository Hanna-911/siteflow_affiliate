import { getCurrentAffiliate } from "@/lib/current-affiliate";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";

export default async function PendingPage() {
  const affiliate = await getCurrentAffiliate();
  if (!affiliate) redirect("/login");

  const supabase = await createClient();
  void supabase; // status text below reads straight from affiliate.status

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <span className="text-lg font-bold tracking-tight">
          Site<span className="text-brand">Flow</span> Affiliates
        </span>
        <SignOutButton />
      </header>
      <div className="mx-auto mt-24 max-w-md px-6 text-center">
        {affiliate.status === "rejected" ? (
          <>
            <h1 className="text-2xl font-bold">Application not approved</h1>
            <p className="mt-3 text-slate">
              Your affiliate application wasn&apos;t approved. If you think
              this is a mistake, reach out to us directly.
            </p>
          </>
        ) : affiliate.status === "suspended" ? (
          <>
            <h1 className="text-2xl font-bold">Account suspended</h1>
            <p className="mt-3 text-slate">
              Your affiliate account is currently suspended. Contact us if you
              have questions.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Waiting on approval</h1>
            <p className="mt-3 text-slate">
              Thanks for signing up! Your account is pending review. Once an
              admin approves it, you&apos;ll get full access to your
              dashboard — refresh this page after you hear from us.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
