"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ApprovalButtons({ affiliateId }: { affiliateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const act = async (action: "approve" | "reject") => {
    setLoading(true);
    await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliateId }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <button
        disabled={loading}
        onClick={() => act("reject")}
        className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-danger hover:text-danger disabled:opacity-50"
      >
        Reject
      </button>
      <button
        disabled={loading}
        onClick={() => act("approve")}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
      >
        Approve
      </button>
    </div>
  );
}
