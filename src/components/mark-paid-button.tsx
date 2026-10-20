"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkPaidButton({
  affiliateId,
  period,
  amount,
}: {
  affiliateId: string;
  period: string;
  amount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        if (!window.confirm(`Mark $${amount.toFixed(2)} for ${period} as PAID? Only do this after you actually sent the money.`)) return;
        setLoading(true);
        await fetch("/api/admin/mark-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ affiliateId, period }),
        });
        setLoading(false);
        router.refresh();
      }}
      className="mt-2 rounded-full bg-flow px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Marking..." : `Mark ${period} paid ($${amount.toFixed(2)})`}
    </button>
  );
}
