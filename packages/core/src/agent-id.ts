/** OpenClaw agent ids are short lowercase tokens without reserved prefixes. */
export function slugAgentId(seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const body = (compact || "agent").slice(0, 16);
  return `sbx${body}`;
}
