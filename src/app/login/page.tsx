"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // middleware.ts routes pending/rejected accounts to /pending and
    // approved ones to /dashboard automatically, so a plain refresh works.
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-4">
        <span className="text-lg font-bold tracking-tight">
          Site<span className="text-brand">Flow</span> Affiliates
        </span>
      </header>
      <div className="mx-auto mt-16 max-w-md px-6">
        <h1 className="mb-6 text-3xl font-bold">Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate">
          Need access? <Link href="/register" className="underline">Request an account</Link>
        </p>
      </div>
    </div>
  );
}
