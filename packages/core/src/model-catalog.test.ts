import { describe, expect, it } from "vitest";
import {
  catalogForTag,
  enrichModels,
  formatRamGuide,
  modelBand,
} from "./model-catalog";

describe("model-catalog", () => {
  it("matches tag families", () => {
    expect(catalogForTag("qwen3.6:latest")?.greatAt).toContain("reasoning");
    expect(catalogForTag("ollama/smollm:135m")?.greatAt).toContain("fast FAQ");
    expect(catalogForTag("unknown-model:1")).toBeUndefined();
  });

  it("enriches live models", () => {
    const rows = enrichModels([
      { tag: "smollm:135m", size: 90_000_000 },
      { tag: "qwen3.6:latest", size: 20_000_000_000 },
    ]);
    expect(rows[0].band).toBe("compact");
    expect(rows[0].greatAt.length).toBeGreaterThan(0);
    expect(rows[1].band).toBe("large");
    expect(rows[1].ramGuideBytes).toBeGreaterThan(0);
  });

  it("formats ram guide", () => {
    expect(formatRamGuide(512 * 1024 * 1024)).toMatch(/MB|GB/);
    expect(modelBand(100_000_000)).toBe("compact");
  });
});
