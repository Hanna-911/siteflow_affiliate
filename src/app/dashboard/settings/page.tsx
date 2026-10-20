"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [marketingPlatform, setMarketingPlatform] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("affiliates")
        .select("full_name, marketing_platform, email")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? "");
        setMarketingPlatform(data.marketing_platform ?? "");
        setEmail(data.email);
      }
    })();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/affiliate/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, marketingPlatform }),
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
      <h1 className="mt-4 text-2xl font-bold">Account settings</h1>

      <form onSubmit={handleSave} className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate">Email</label>
          <input
            value={email}
            disabled
            className="w-full rounded-lg border border-line bg-canvas px-4 py-3 text-slate"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate">
            Marketing platform (optional)
          </label>
          <input
            value={marketingPlatform}
            onChange={(e) => setMarketingPlatform(e.target.value)}
            placeholder="e.g. YouTube, Instagram, a newsletter"
            className="w-full rounded-lg border border-line px-4 py-3"
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
