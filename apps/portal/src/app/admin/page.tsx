"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Client = { userId: string; email: string; name: string; role: string };
type Sandbox = {
  sandboxId: string;
  name: string;
  modelRef: string;
  openclawAgentId: string;
};
type Member = { userId: string; email: string; name: string };

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedSandbox, setSelectedSandbox] = useState("");
  const [error, setError] = useState("");
  const [clientForm, setClientForm] = useState({
    email: "",
    password: "",
    name: "",
    modelRef: "ollama/qwen3.6:latest",
  });
  const [sandboxForm, setSandboxForm] = useState({
    name: "",
    modelRef: "ollama/qwen3:30b",
  });
  const [grantUserId, setGrantUserId] = useState("");

  async function refresh() {
    const [clientsRes, sandboxesRes] = await Promise.all([
      fetch("/api/admin/clients"),
      fetch("/api/admin/sandboxes"),
    ]);
    const clientsData = await clientsRes.json();
    const sandboxesData = await sandboxesRes.json();
    if (!clientsRes.ok) {
      throw new Error(clientsData.error ?? "admin only");
    }
    setClients(clientsData.clients);
    setSandboxes(sandboxesData.sandboxes);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedSandbox) {
      setMembers([]);
      return;
    }
    fetch(`/api/admin/sandboxes/${selectedSandbox}/members`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "failed");
        }
        setMembers(data.members);
      })
      .catch((err: Error) => setError(err.message));
  }, [selectedSandbox]);

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Sandboxes and clients</h1>
        </div>
        <Link href="/" className="text-sm text-[var(--muted)]">
          ← Console
        </Link>
      </header>
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-5">
        <h2 className="mb-4 text-lg font-medium">Create client</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Creates a private sandbox. Client A cannot read Client B unless you
          grant a shared sandbox.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const response = await fetch("/api/admin/clients", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(clientForm),
            });
            const data = await response.json();
            if (!response.ok) {
              setError(data.error ?? "create failed");
              return;
            }
            setClientForm({
              email: "",
              password: "",
              name: "",
              modelRef: "ollama/qwen3.6:latest",
            });
            await refresh();
          }}
        >
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Name"
            value={clientForm.name}
            onChange={(event) =>
              setClientForm({ ...clientForm, name: event.target.value })
            }
            required
          />
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Email"
            type="email"
            value={clientForm.email}
            onChange={(event) =>
              setClientForm({ ...clientForm, email: event.target.value })
            }
            required
          />
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Password (8+)"
            type="password"
            value={clientForm.password}
            onChange={(event) =>
              setClientForm({ ...clientForm, password: event.target.value })
            }
            required
          />
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Model ref"
            value={clientForm.modelRef}
            onChange={(event) =>
              setClientForm({ ...clientForm, modelRef: event.target.value })
            }
            required
          />
          <button className="rounded-md bg-[var(--accent)] px-3 py-2 font-medium text-[#06251c] sm:col-span-2">
            Create client + private sandbox
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-5">
        <h2 className="mb-4 text-lg font-medium">Create sandbox</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await fetch("/api/admin/sandboxes", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(sandboxForm),
            });
            const data = await response.json();
            if (!response.ok) {
              setError(data.error ?? "create failed");
              return;
            }
            setSandboxForm({ name: "", modelRef: "ollama/qwen3:30b" });
            await refresh();
          }}
        >
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Sandbox name"
            value={sandboxForm.name}
            onChange={(event) =>
              setSandboxForm({ ...sandboxForm, name: event.target.value })
            }
            required
          />
          <input
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            placeholder="Model ref"
            value={sandboxForm.modelRef}
            onChange={(event) =>
              setSandboxForm({ ...sandboxForm, modelRef: event.target.value })
            }
            required
          />
          <button className="rounded-md bg-[var(--accent)] px-3 py-2 font-medium text-[#06251c] sm:col-span-2">
            Create sandbox
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-5">
        <h2 className="mb-4 text-lg font-medium">Grant access</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            value={selectedSandbox}
            onChange={(event) => setSelectedSandbox(event.target.value)}
          >
            <option value="">Select sandbox</option>
            {sandboxes.map((sandbox) => (
              <option key={sandbox.sandboxId} value={sandbox.sandboxId}>
                {sandbox.name} ({sandbox.modelRef})
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            value={grantUserId}
            onChange={(event) => setGrantUserId(event.target.value)}
          >
            <option value="">Select client</option>
            {clients
              .filter((client) => client.role === "client")
              .map((client) => (
                <option key={client.userId} value={client.userId}>
                  {client.name} ({client.email})
                </option>
              ))}
          </select>
          <button
            type="button"
            className="rounded-md bg-[var(--accent)] px-3 py-2 font-medium text-[#06251c]"
            onClick={async () => {
              if (!selectedSandbox || !grantUserId) {
                return;
              }
              const response = await fetch(
                `/api/admin/sandboxes/${selectedSandbox}/members`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ userId: grantUserId }),
                },
              );
              const data = await response.json();
              if (!response.ok) {
                setError(data.error ?? "grant failed");
                return;
              }
              const membersRes = await fetch(
                `/api/admin/sandboxes/${selectedSandbox}/members`,
              );
              setMembers((await membersRes.json()).members);
            }}
          >
            Grant
          </button>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between border-b border-[var(--line)] py-2"
            >
              <span>
                {member.name} ({member.email})
              </span>
              <button
                type="button"
                className="text-[var(--danger)]"
                onClick={async () => {
                  await fetch(
                    `/api/admin/sandboxes/${selectedSandbox}/members`,
                    {
                      method: "DELETE",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ userId: member.userId }),
                    },
                  );
                  setMembers((current) =>
                    current.filter((row) => row.userId !== member.userId),
                  );
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
