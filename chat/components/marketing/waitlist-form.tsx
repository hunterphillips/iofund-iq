"use client";

import { useState } from "react";
import type { MemberStatus } from "@/lib/waitlist/schema";

const OPTIONS: { value: MemberStatus; label: string; hint: string }[] = [
  { value: "member", label: "I'm a member", hint: "I subscribe to I/O Fund" },
  { value: "prospect", label: "Not yet", hint: "I'd subscribe to get this" },
  { value: "considering", label: "Considering", hint: "Looking into I/O Fund" },
];

type Status = "idle" | "submitting" | "done" | "error";

export function WaitlistForm({ className = "" }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [memberStatus, setMemberStatus] = useState<MemberStatus | null>(null);
  const [interest, setInterest] = useState("");
  const [showInterest, setShowInterest] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!memberStatus) {
      setError("Pick the option that fits you.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, memberStatus, interest }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div
        className={`rounded-2xl border border-border bg-surface/70 p-7 text-center backdrop-blur ${className}`}
      >
        <p className="font-serif text-2xl text-cream">You're on the list.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          We'll reach out when access opens. Members go first.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur sm:p-6 ${className}`}
      noValidate
    >
      <label
        htmlFor="waitlist-email"
        className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-deep"
      >
        Request access
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-bg/60 px-4 py-3 font-mono text-[0.95rem] text-cream outline-none transition placeholder:text-muted-deep focus:border-orange/70 focus:ring-2 focus:ring-orange/20"
      />

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted-deep">
          Your I/O Fund status
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const active = memberStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMemberStatus(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-orange/70 bg-orange/10"
                    : "border-border bg-bg/40 hover:border-muted-deep"
                }`}
              >
                <span className="block text-sm font-medium text-cream">
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {showInterest ? (
        <div className="mt-4">
          <label
            htmlFor="waitlist-interest"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted-deep"
          >
            What would you want it to do?{" "}
            <span className="normal-case tracking-normal text-muted-deep">
              (optional)
            </span>
          </label>
          <textarea
            id="waitlist-interest"
            rows={2}
            maxLength={500}
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="e.g. catch every portfolio change without reading every alert"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-bg/60 px-4 py-3 text-sm text-cream outline-none transition placeholder:text-muted-deep focus:border-orange/70 focus:ring-2 focus:ring-orange/20"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowInterest(true)}
          className="mt-3 text-xs text-muted underline-offset-4 hover:text-cream hover:underline"
        >
          + Add what you'd want it to do
        </button>
      )}

      {error ? (
        <p className="mt-3 text-sm text-orange" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-4 w-full rounded-xl bg-orange px-5 py-3 text-sm font-semibold tracking-wide text-bg transition hover:brightness-110 disabled:opacity-60"
      >
        {status === "submitting" ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-muted-deep">
        Independent project. Not affiliated with or endorsed by I/O Fund.
      </p>
    </form>
  );
}
