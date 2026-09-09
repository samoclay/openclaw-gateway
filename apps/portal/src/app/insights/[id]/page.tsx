"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Insight = {
  insightId: string;
  title: string;
  summary: string;
  category: string;
  severity: string;
  confidence: string;
  status: string;
  evidence: string[];
  metrics: Record<string, number>;
  recommendedAction: string;
  periodStart: string;
  periodEnd: string;
};

export default function InsightDetailPage() {
  const params = useParams<{ id: string }>();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch(`/api/insights/${params.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "failed to load");
        }
        setInsight(data.insight);
      })
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  async function setStatus(status: "acknowledged" | "approved" | "dismissed") {
    if (!insight) {
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch(`/api/insights/${insight.insightId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "update failed");
      return;
    }
    setInsight(data.insight);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/insights" className="text-sm text-[var(--muted)]">
        ← Insights
      </Link>
      {error ? <p className="mt-4 text-[var(--danger)]">{error}</p> : null}
      {insight ? (
        <article className="mt-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            {insight.category} · {insight.periodStart} – {insight.periodEnd}
          </p>
          <h1 className="text-3xl font-semibold">{insight.title}</h1>
          <p className="text-[var(--muted)]">{insight.summary}</p>
          <p className="text-sm">
            Confidence {insight.confidence} · Severity {insight.severity} ·{" "}
            {insight.status}
          </p>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-4">
            <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">
              Evidence
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {insight.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-4">
            <h2 className="text-sm uppercase tracking-wide text-[var(--muted)]">
              Recommended action
            </h2>
            <p className="mt-2">{insight.recommendedAction}</p>
          </section>
          {insight.status === "new" || insight.status === "acknowledged" ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[#06251c]"
                onClick={() => void setStatus("approved")}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--line)] px-4 py-2"
                onClick={() => void setStatus("dismissed")}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}
