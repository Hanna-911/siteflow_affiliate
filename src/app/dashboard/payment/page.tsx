"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Method = "paypal" | "bank" | "payoneer";

export default function PaymentMethodPage() {
  const supabase = createClient();
  const [method, setMethod] = useState<Method>("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [payoneerEmail, setPayoneerEmail] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCountry, setBankCountry] = useState("");
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
        .from("payout_methods")
        .select("*")
        .eq("affiliate_id", user.id)
        .maybeSingle();
      if (!data) return;
      if (data.active_method) setMethod(data.active_method);
      setPaypalEmail(data.paypal_email ?? "");
      setPayoneerEmail(data.payoneer_email ?? "");
      setBankAccountHolder(data.bank_account_holder ?? "");
      setBankAccountNumber(data.bank_account_number ?? "");
      setBankRoutingNumber(data.bank_routing_number ?? "");
      setBankName(data.bank_name ?? "");
      setBankCountry(data.bank_country ?? "");
    })();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/affiliate/payment-method", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activeMethod: method,
        paypalEmail,
        payoneerEmail,
        bankAccountHolder,
        bankAccountNumber,
        bankRoutingNumber,
        bankName,
        bankCountry,
      }),
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
      <h1 className="mt-4 text-2xl font-bold">Payment method</h1>
      <p className="mt-2 text-sm text-slate">
        Commissions are sent manually at the end of each month to whichever
        method is selected here.
      </p>

      <div className="mt-6 flex gap-2">
        {(["paypal", "bank", "payoneer"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold capitalize " +
              (method === m ? "bg-ink text-white" : "border border-line")
            }
          >
            {m}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-3">
        {method === "paypal" && (
          <input
            type="email"
            placeholder="PayPal email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3"
            required
          />
        )}
        {method === "payoneer" && (
          <input
            type="email"
            placeholder="Payoneer email"
            value={payoneerEmail}
            onChange={(e) => setPayoneerEmail(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3"
            required
          />
        )}
        {method === "bank" && (
          <>
            <input
              placeholder="Account holder name"
              value={bankAccountHolder}
              onChange={(e) => setBankAccountHolder(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3"
              required
            />
            <input
              placeholder="Account number / IBAN"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3"
              required
            />
            <input
              placeholder="Routing number / SWIFT / BIC"
              value={bankRoutingNumber}
              onChange={(e) => setBankRoutingNumber(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3"
              required
            />
            <input
              placeholder="Bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3"
              required
            />
            <input
              placeholder="Bank country"
              value={bankCountry}
              onChange={(e) => setBankCountry(e.target.value)}
              className="w-full rounded-lg border border-line px-4 py-3"
              required
            />
          </>
        )}
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
