/** Curated open-model catalog metadata for Access / Workspace (not marketing pages). */

export type ModelCatalogEntry = {
  /** Exact tag or family prefix matched against live Ollama tags. */
  match: string;
  greatAt: string[];
  /** Typical loaded RAM guide in bytes (may differ from advertised blob size). */
  ramGuideBytes: number;
  caveats?: string;
};

export type LiveModel = {
  tag: string;
  size: number;
};

export type EnrichedModel = LiveModel & {
  greatAt: string[];
  ramGuideBytes: number;
  caveats?: string;
  band: "compact" | "standard" | "large";
};

const COMPACT_MAX = 200 * 1024 * 1024;
const LARGE_MIN = 400 * 1024 * 1024;

/** Ordered: first match wins (more specific prefixes first). */
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    match: "smollm",
    greatAt: ["fast FAQ", "smoke tests", "low-RAM agents"],
    ramGuideBytes: 512 * 1024 * 1024,
    caveats: "Weak for long drafting or deep reasoning.",
  },
  {
    match: "qwen2.5-coder",
    greatAt: ["coding", "refactors", "technical docs"],
    ramGuideBytes: 8 * 1024 * 1024 * 1024,
  },
  {
    match: "qwen2.5",
    greatAt: ["general drafting", "summaries", "business writing"],
    ramGuideBytes: 8 * 1024 * 1024 * 1024,
  },
  {
    match: "qwen3",
    greatAt: ["reasoning", "careful drafting", "multi-step tasks"],
    ramGuideBytes: 16 * 1024 * 1024 * 1024,
  },
  {
    match: "llama3.1",
    greatAt: ["general chat", "instructions", "light reasoning"],
    ramGuideBytes: 8 * 1024 * 1024 * 1024,
  },
  {
    match: "llama3",
    greatAt: ["general chat", "instructions"],
    ramGuideBytes: 8 * 1024 * 1024 * 1024,
  },
];

export function modelBand(sizeBytes: number): "compact" | "standard" | "large" {
  const n = Number(sizeBytes) || 0;
  if (n > 0 && n < COMPACT_MAX) return "compact";
  if (n >= LARGE_MIN) return "large";
  return "standard";
}

function tagKey(tag: string): string {
  const t = (tag || "").trim();
  return t.startsWith("ollama/") ? t.slice(7) : t;
}

export function catalogForTag(tag: string): ModelCatalogEntry | undefined {
  const key = tagKey(tag).toLowerCase();
  return MODEL_CATALOG.find((row) => key === row.match || key.startsWith(row.match));
}

export function enrichModels(live: LiveModel[]): EnrichedModel[] {
  return (live || []).map((m) => {
    const meta = catalogForTag(m.tag);
    return {
      tag: m.tag,
      size: Number(m.size) || 0,
      greatAt: meta?.greatAt ? [...meta.greatAt] : ["general use"],
      ramGuideBytes: meta?.ramGuideBytes ?? (Number(m.size) || 0),
      caveats: meta?.caveats,
      band: modelBand(m.size),
    };
  });
}

export function formatRamGuide(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n <= 0) return "unknown";
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  const mb = n / (1024 * 1024);
  return `${Math.max(1, Math.round(mb))} MB`;
}
