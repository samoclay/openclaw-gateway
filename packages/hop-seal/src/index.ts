import crypto from "node:crypto";

export const HOP_SALT = Buffer.from("halcyon-hop-v1");
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

export type HopKeyPair = {
  publicKeyRaw: Buffer;
  privateKey: crypto.KeyObject;
};

function aadBytes(sandboxId: string, threadId: string): Buffer {
  return Buffer.from(`${sandboxId}:${threadId}`, "utf8");
}

export function generateHopKeyPair(): HopKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  return { publicKeyRaw: spki.subarray(-32), privateKey };
}

export function publicKeyFromRaw(raw: Buffer): crypto.KeyObject {
  if (raw.length !== 32) {
    throw new Error("x25519 public key must be 32 bytes");
  }
  return crypto.createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export function sharedSecret(
  privateKey: crypto.KeyObject,
  peerPublicRaw: Buffer,
): Buffer {
  return crypto.diffieHellman({
    privateKey,
    publicKey: publicKeyFromRaw(peerPublicRaw),
  }) as Buffer;
}

export function hopAesKey(
  secret: Buffer,
  sandboxId: string,
  threadId: string,
): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      secret,
      HOP_SALT,
      aadBytes(sandboxId, threadId),
      32,
    ),
  );
}

export function sealJson(
  privateKey: crypto.KeyObject,
  peerPublicRaw: Buffer,
  sandboxId: string,
  threadId: string,
  payload: unknown,
): string {
  const key = hopAesKey(
    sharedSecret(privateKey, peerPublicRaw),
    sandboxId,
    threadId,
  );
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aadBytes(sandboxId, threadId));
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64url");
}

export function openJson(
  privateKey: crypto.KeyObject,
  peerPublicRaw: Buffer,
  sandboxId: string,
  threadId: string,
  sealed: string,
): unknown {
  const key = hopAesKey(
    sharedSecret(privateKey, peerPublicRaw),
    sandboxId,
    threadId,
  );
  const blob = Buffer.from(sealed, "base64url");
  if (blob.length < 28) {
    throw new Error("sealed box too short");
  }
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const encrypted = blob.subarray(12, blob.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aadBytes(sandboxId, threadId));
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}
