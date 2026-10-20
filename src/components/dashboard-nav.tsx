import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import type { AffiliateRow } from "@/lib/current-affiliate";

export default function DashboardNav({ affiliate }: { affiliate: AffiliateRow }) {
  return (
    <header className="border-b border-line px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <span className="text-lg font-bold tracking-tight">
          Site<span className="text-brand">Flow</span> Affiliates
        </span>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/dashboard" className="hover:text-brand">
            Dashboard
          </Link>
          <Link href="/dashboard/link" className="hover:text-brand">
            Referral link
          </Link>
          <Link href="/dashboard/payment" className="hover:text-brand">
            Payment method
          </Link>
          <Link href="/dashboard/settings" className="hover:text-brand">
            Settings
          </Link>
          {affiliate.role === "admin" && (
            <Link href="/admin" className="text-brand hover:underline">
              Admin
            </Link>
          )}
          <SignOutButton />
        </nav>
      </div>
    </header>
  );
}
