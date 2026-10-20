"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateSlug } from "@/lib/slug";

export default function RegisterPage() {
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [marketingPlatform, setMarketingPlatform] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const slug = generateSlug(fullName || email);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          slug,
          marketing_platform: marketingPlatform || null,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <Shell>
        <h1 className="text-3xl font-bold mb-3">Request received</h1>
        <p className="text-slate">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          verify your email, then log in. Your account will show as{" "}
          <strong>pending approval</strong> until we review and approve it —
          you&apos;ll be able to log in but the dashboard stays locked until
          then.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-bold mb-2">Request affiliate access</h1>
      <p className="text-sm text-slate mb-6">
        This is a private, invite-reviewed affiliate program for SiteFlow.
        Submitting this form doesn&apos;t grant access automatically — an
        admin approves each account.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full rounded-lg border border-line px-4 py-3"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-line px-4 py-3"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-line px-4 py-3"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-line px-4 py-3"
        />
        <input
          type="text"
          placeholder="Marketing platform (optional) — e.g. YouTube, Instagram"
          value={marketingPlatform}
          onChange={(e) => setMarketingPlatform(e.target.value)}
          className="w-full rounded-lg border border-line px-4 py-3"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Request access"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate">
        Already approved? <Link href="/login" className="underline">Log in</Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-4">
        <span className="text-lg font-bold tracking-tight">
          Site<span className="text-brand">Flow</span> Affiliates
        </span>
      </header>
      <div className="mx-auto mt-16 max-w-md px-6">{children}</div>
    </div>
  );
}
