"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectIofForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/onboarding/connect-iof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error ?? "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.replace("/fund");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span className="field-label">I/O Fund email</span>
        <input
          className="field-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </label>
      <label className="field">
        <span className="field-label">I/O Fund password</span>
        <input
          className="field-input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button className="cta" type="submit" disabled={submitting}>
        {submitting ? "Verifying…" : "Connect account"}
      </button>
    </form>
  );
}
