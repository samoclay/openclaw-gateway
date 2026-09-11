import { describe, expect, it } from "vitest";
import { generateHopKeyPair, openJson, sealJson } from "./index";

describe("hop-seal", () => {
  it("round-trips JSON for matching AAD", () => {
    const sidecar = generateHopKeyPair();
    const browser = generateHopKeyPair();
    const sealed = sealJson(
      browser.privateKey,
      sidecar.publicKeyRaw,
      "sandbox-a",
      "thread-1",
      { message: "hello crew" },
    );
    expect(sealed).not.toMatch(/hello/);
    const opened = openJson(
      sidecar.privateKey,
      browser.publicKeyRaw,
      "sandbox-a",
      "thread-1",
      sealed,
    );
    expect(opened).toEqual({ message: "hello crew" });
  });

  it("fails closed when sandbox AAD does not match", () => {
    const sidecar = generateHopKeyPair();
    const browser = generateHopKeyPair();
    const sealed = sealJson(
      browser.privateKey,
      sidecar.publicKeyRaw,
      "sandbox-a",
      "thread-1",
      { message: "nope" },
    );
    expect(() =>
      openJson(
        sidecar.privateKey,
        browser.publicKeyRaw,
        "sandbox-b",
        "thread-1",
        sealed,
      ),
    ).toThrow();
  });
});
