"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function SandboxChatPage() {
  const params = useParams<{ id: string }>();
  const sandboxId = params.id;
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput("");
    setPending(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: text }]);

    const response = await fetch(`/api/sandboxes/${sandboxId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: text,
        threadId,
        agentId: "ignored",
        model: "ignored",
        sessionKey: "ignored",
      }),
    });

    const nextThread = response.headers.get("x-thread-id");
    if (nextThread) {
      setThreadId(nextThread);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "chat failed" }));
      setError(data.error ?? "chat failed");
      setPending(false);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      setPending(false);
      return;
    }

    const decoder = new TextDecoder();
    let assistant = "";
    setMessages((current) => [...current, { role: "assistant", content: "" }]);

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          continue;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content ?? "";
          assistant += delta;
          setMessages((current) => {
            const copy = [...current];
            copy[copy.length - 1] = { role: "assistant", content: assistant };
            return copy;
          });
        } catch {
          assistant += payload;
        }
      }
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex gap-4 text-sm text-[var(--muted)]">
          <Link href="/">← Sandboxes</Link>
          <Link href="/insights">Insights</Link>
        </div>
        <button
          type="button"
          className="text-sm text-[var(--accent)]"
          onClick={() => {
            setThreadId(null);
            setMessages([]);
          }}
        >
          New thread
        </button>
      </header>
      <section className="flex-1 space-y-3">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] p-4"
          >
            <p className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">
              {message.role}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
        {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      </section>
      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message this sandbox…"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[#06251c]"
        >
          Send
        </button>
      </form>
    </main>
  );
}
