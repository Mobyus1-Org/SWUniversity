import type { NextApiRequest, NextApiResponse } from "next";

import { getClientIp, methodNotAllowed } from "@/server/auth/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { consumePersistentRateLimit } from "@/server/auth/persistent-rate-limit";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv, getRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";
import { UserProfileModel } from "@/server/models/UserProfile";

type SignupBody = {
  username?: string;
  email?: string;
  password?: string;
};

const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_MAX_ATTEMPTS = 5;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const ip = getClientIp(request);

    const body = request.body as SignupBody;
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";

    if (!username || !email || !password) {
      return response.status(400).json({ error: "username, email, and password are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: "Invalid email address." });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return response.status(400).json({ error: passwordError });
    }

    const rateLimitResult = await consumePersistentRateLimit({
      scope: "signup",
      key: ip,
      maxAttempts: SIGNUP_MAX_ATTEMPTS,
      windowMs: SIGNUP_WINDOW_MS,
    });
    if (!rateLimitResult.allowed) {
      return response.status(429).json({ error: "Too many signup attempts. Please try again later." });
    }

    const duplicateUser = await UserModel.findOne({ username }).select("_id").lean();
    if (duplicateUser) {
      return response.status(409).json({ error: "Username is already in use." });
    }

    const passwordHash = await hashPassword(password);
    const pepperVersion = getRequiredEnv("PEPPER_VERSION");
    const user = await UserModel.create({
      username,
      email,
      passwordHash,
      passwordPepperVersion: pepperVersion,
      role: "user",
    });

    // Create UserProfile for the new user
    await UserProfileModel.create({
      userId: user._id,
      gamesCompleted: [],
      endlessModeStats: {
        quiz: {
          correct: 0,
          total: 0,
          difficultyBreakdown: {
            padawan: { correct: 0, total: 0 },
            knight: { correct: 0, total: 0 },
            master: { correct: 0, total: 0 },
          },
        },
        dykswu: {
          correct: 0,
          total: 0,
          difficultyBreakdown: {
            padawan: { correct: 0, total: 0 },
            knight: { correct: 0, total: 0 },
            master: { correct: 0, total: 0 },
          },
        },
      },
      badges: [],
    });

    const sessionId = await createSession(user._id.toString(), false);
    setSessionCookie(response, sessionId, false);

    return response.status(201).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("signup error", error);
    return response.status(500).json({ error: "Unable to create account." });
  }
}
