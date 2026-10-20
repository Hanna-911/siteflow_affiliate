"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditLinkPage() {
  const supabase = createClient();
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const siteflowUrl = process.env.NEXT_PUBLIC_SITEFLOW_URL ?? "https://siteflow-omega.vercel.app";

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("affiliates").select("slug").eq("id", user.id).single();
      if (data) setSlug(data.slug);
    })();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/affiliate/link", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const body = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    setMessage("Saved!");
  };

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <a href="/dashboard" className="text-sm text-brand underline">
        ← Back to dashboard
      </a>
      <h1 className="mt-4 text-2xl font-bold">Edit your referral link</h1>
      <p className="mt-2 text-sm text-slate">
        Letters, numbers and dashes only. Your old link keeps working and keeps
        crediting you, so you can change this safely.
      </p>
      <form onSubmit={handleSave} className="mt-6 space-y-3">
        <div className="flex items-center rounded-lg border border-line px-4 py-3">
          <span className="text-slate">{siteflowUrl}/?ref=</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="flex-1 outline-none"
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-flow">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-ink px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
