"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Insight = {
  insightId: string;
  tenantId: string;
  title: string;
  summary: string;
  category: string;
  severity: string;
  confidence: string;
  status: string;
  createdAt: string;
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/insights")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "failed to load");
        }
        setInsights(data.insights);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
            Halcyon
          </p>
          <h1 className="text-3xl font-semibold">Business Insights</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Recommendations from your usage — not raw telemetry.
          </p>
        </div>
        <Link className="text-sm text-[var(--muted)]" href="/">
          Sandboxes
        </Link>
      </header>
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <ul className="space-y-3">
        {insights.map((insight) => (
          <li key={insight.insightId}>
            <Link
              href={`/insights/${insight.insightId}`}
              className="block rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-4 hover:border-[var(--accent)]"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {insight.category} · {insight.severity} · {insight.status}
              </p>
              <p className="mt-1 font-medium">{insight.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{insight.summary}</p>
            </Link>
          </li>
        ))}
        {insights.length === 0 && !error ? (
          <li className="text-sm text-[var(--muted)]">
            No insights yet. They appear after your workspace has usage to
            analyse.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
