import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type SignupBody = {
  username?: string;
  email?: string;
  password?: string;
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const body = request.body as SignupBody;
    const username = body.username?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";

    if (!username || !email || !password) {
      return response.status(400).json({ error: "username, email, and password are required." });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return response.status(400).json({ error: passwordError });
    }

    const duplicateUser = await UserModel.findOne({ username }).select("_id").lean();
    if (duplicateUser) {
      return response.status(409).json({ error: "Username is already in use." });
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({
      username,
      email,
      passwordHash,
      role: "user",
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
