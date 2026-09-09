"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Sandbox = { id: string; name: string; modelRef: string };
type Me = { role: string; email: string; name: string };

export default function HomePage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sandboxes")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "failed to load");
        }
        setSandboxes(data.sandboxes);
        setMe(data.me);
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
          <h1 className="text-3xl font-semibold">Your sandboxes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {me ? `${me.email} · ${me.role}` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          {me?.role === "admin" ? (
            <Link className="text-[var(--accent)]" href="/admin">
              Admin
            </Link>
          ) : null}
          <button
            type="button"
            className="text-[var(--muted)]"
            onClick={() =>
              fetch("/api/auth/logout", { method: "POST" }).then(
                () => (window.location.href = "/login"),
              )
            }
          >
            Sign out
          </button>
        </div>
      </header>
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <ul className="space-y-3">
        {sandboxes.map((sandbox) => (
          <li key={sandbox.id}>
            <Link
              href={`/sandboxes/${sandbox.id}`}
              className="block rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-4 hover:border-[var(--accent)]"
            >
              <p className="font-medium">{sandbox.name}</p>
              <p className="text-sm text-[var(--muted)]">{sandbox.modelRef}</p>
            </Link>
          </li>
        ))}
        {sandboxes.length === 0 && !error ? (
          <li className="text-sm text-[var(--muted)]">
            No sandboxes yet. An admin must grant access.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
