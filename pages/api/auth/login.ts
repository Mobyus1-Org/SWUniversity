import type { NextApiRequest, NextApiResponse } from "next";

import { getClientIp, methodNotAllowed } from "@/server/auth/http";
import { hashPassword, verifyPasswordWithPepperRotation } from "@/server/auth/password";
import {
  clearPersistentRateLimit,
  consumePersistentRateLimit,
  getPersistentRateLimitStatus,
} from "@/server/auth/persistent-rate-limit";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv, getRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type LoginBody = {
  username?: string;
  password?: string;
  rememberMe?: boolean;
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const LOGIN_BLOCK_DURATION_MS = 10 * 60 * 1000;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const body = request.body as LoginBody;
    const pepperVersion = getRequiredEnv("PEPPER_VERSION");
    const username = body.username?.trim() || "";
    const password = body.password || "";
    const rememberMe = Boolean(body.rememberMe);
    const ip = getClientIp(request);
    const loginRateLimitKey = `${ip}::${username.toLowerCase()}`;

    if (!username || !password) {
      return response.status(400).json({ error: "Username and password are required." });
    }

    const rateLimitStatus = await getPersistentRateLimitStatus({
      scope: "login",
      key: loginRateLimitKey,
    });
    if (!rateLimitStatus.allowed) {
      return response.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    const user = await UserModel.findOne({ username });
    const verification = user
      ? await verifyPasswordWithPepperRotation(password, user.passwordHash)
      : { isValid: false, needsRehash: false };

    if (!user || !verification.isValid) {
      await consumePersistentRateLimit({
        scope: "login",
        key: loginRateLimitKey,
        maxAttempts: LOGIN_MAX_FAILURES,
        windowMs: LOGIN_WINDOW_MS,
        blockDurationMs: LOGIN_BLOCK_DURATION_MS,
      });
      return response.status(401).json({ error: "Invalid username or password." });
    }

    if (verification.needsRehash) {
      user.passwordHash = await hashPassword(password);
      user.passwordPepperVersion = pepperVersion;
      await user.save();
    } else if (user.passwordPepperVersion !== pepperVersion) {
      // Backfill metadata for users that already verified against current pepper.
      user.passwordPepperVersion = pepperVersion;
      await user.save();
    }

    await clearPersistentRateLimit({
      scope: "login",
      key: loginRateLimitKey,
    });

    const sessionId = await createSession(user._id.toString(), rememberMe);
    setSessionCookie(response, sessionId, rememberMe);

    return response.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("login error", error);
    return response.status(500).json({ error: "Unable to sign in." });
  }
}
