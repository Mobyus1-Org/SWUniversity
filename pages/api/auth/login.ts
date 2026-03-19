import type { NextApiRequest, NextApiResponse } from "next";

import { getClientIp, methodNotAllowed } from "@/server/auth/http";
import { verifyPassword } from "@/server/auth/password";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/server/auth/rate-limit";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type LoginBody = {
  username?: string;
  password?: string;
  rememberMe?: boolean;
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const body = request.body as LoginBody;
    const username = body.username?.trim() || "";
    const password = body.password || "";
    const rememberMe = Boolean(body.rememberMe);
    const ip = getClientIp(request);

    if (!username || !password) {
      return response.status(400).json({ error: "Username and password are required." });
    }

    if (isLoginBlocked(ip, username)) {
      return response.status(429).json({ error: "Too many login attempts. Please try again later." });
    }

    const user = await UserModel.findOne({ username }).lean();
    const isValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !isValid) {
      recordLoginFailure(ip, username);
      return response.status(401).json({ error: "Invalid username or password." });
    }

    clearLoginFailures(ip, username);

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
