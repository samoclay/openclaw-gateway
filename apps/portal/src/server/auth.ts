import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@halcyon/core";
import { env } from "./env";
import { hashToken, randomToken } from "./passwords";
import type { PortalStore } from "../db/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionClaims = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-halcyon_session"
    : "halcyon_session";
}

export const SESSION_COOKIE = sessionCookieName();

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setJti(randomToken())
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    userId: String(payload.userId),
    email: String(payload.email),
    name: String(payload.name),
    role: payload.role === "admin" ? "admin" : "client",
  };
}

export function sessionCookie(token: string): string {
  const name = sessionCookieName();
  const maxAge = `Max-Age=${WEEK_MS / 1000}`;
  if (process.env.NODE_ENV === "production") {
    return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; ${maxAge}`;
  }
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; ${maxAge}`;
}

export function clearSessionCookie(): string {
  const name = sessionCookieName();
  if (process.env.NODE_ENV === "production") {
    return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
  }
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  const parts = header.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function persistSession(
  store: PortalStore,
  token: string,
  userId: string,
) {
  await store.putSession({
    tokenHash: await hashToken(token),
    userId,
    expiresAt: Date.now() + WEEK_MS,
  });
}

export async function dropSession(store: PortalStore, token: string) {
  await store.deleteSession(await hashToken(token));
}
