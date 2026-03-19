import crypto from "crypto";
import { serialize, parse } from "cookie";
import type { NextApiRequest, NextApiResponse } from "next";

import { connectToDatabase } from "@/server/db";
import { getRequiredEnv } from "@/server/env";
import { SessionModel } from "@/server/models/Session";
import { UserModel, type UserRole } from "@/server/models/User";

export const SESSION_COOKIE_NAME = "swu_session";
const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export type SafeUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

export type AuthSession = {
  sessionId: string;
  user: SafeUser;
};

function getCookieOptions(maxAgeSeconds?: number) {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    ...(typeof maxAgeSeconds === "number" ? { maxAge: maxAgeSeconds } : {}),
  };
}

function mapSafeUser(user: {
  _id: { toString: () => string };
  username: string;
  email: string;
  role: UserRole;
}): SafeUser {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function signSessionId(sessionId: string): string {
  return crypto
    .createHmac("sha256", getRequiredEnv("SESSION_SECRET"))
    .update(sessionId)
    .digest("hex");
}

function encodeSignedSessionId(sessionId: string): string {
  const signature = signSessionId(sessionId);
  return `${sessionId}.${signature}`;
}

function decodeSignedSessionId(signedValue: string): string | null {
  const [sessionId, providedSignature] = signedValue.split(".");
  if (!sessionId || !providedSignature) {
    return null;
  }

  const expectedSignature = signSessionId(sessionId);
  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

export function setSessionCookie(response: NextApiResponse, sessionId: string, rememberMe: boolean): void {
  const maxAge = rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : undefined;
  response.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE_NAME, encodeSignedSessionId(sessionId), getCookieOptions(maxAge)),
  );
}

export function clearSessionCookie(response: NextApiResponse): void {
  response.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE_NAME, "", {
      ...getCookieOptions(0),
      expires: new Date(0),
    }),
  );
}

export async function createSession(userId: string, rememberMe: boolean): Promise<string> {
  await connectToDatabase();

  const sessionId = crypto.randomBytes(32).toString("hex");
  const maxAgeSeconds = rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : DEFAULT_SESSION_MAX_AGE_SECONDS;
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  await SessionModel.create({
    sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

export async function getSessionFromRequest(request: NextApiRequest): Promise<AuthSession | null> {
  await connectToDatabase();

  const cookies = parse(request.headers.cookie || "");
  const signedSessionId = cookies[SESSION_COOKIE_NAME];
  if (!signedSessionId) {
    return null;
  }

  const sessionId = decodeSignedSessionId(signedSessionId);
  if (!sessionId) {
    return null;
  }

  const session = await SessionModel.findOne({
    sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!session) {
    return null;
  }

  const user = await UserModel.findById(session.userId)
    .select("username email role")
    .lean();

  if (!user) {
    return null;
  }

  return {
    sessionId,
    user: mapSafeUser(user),
  };
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await connectToDatabase();
  await SessionModel.updateOne(
    { sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), expiresAt: new Date() } },
  );
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await connectToDatabase();
  await SessionModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), expiresAt: new Date() } },
  );
}
