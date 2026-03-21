import type { NextApiRequest, NextApiResponse } from "next";

import { getClientIp, methodNotAllowed } from "@/server/auth/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { consumePersistentRateLimit } from "@/server/auth/persistent-rate-limit";
import { isResetCodeMatch } from "@/server/auth/password-reset";
import { clearSessionCookie, revokeAllUserSessions } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv, getRequiredEnv } from "@/server/env";
import { PasswordResetCodeModel } from "@/server/models/PasswordResetCode";
import { UserModel } from "@/server/models/User";

type ResetPasswordBody = {
  username?: string;
  email?: string;
  code?: string;
  newPassword?: string;
};

const GENERIC_FAILURE_MESSAGE = "Invalid or expired reset details.";
const RESET_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const RESET_PASSWORD_MAX_ATTEMPTS = 8;
const RESET_CODE_MAX_FAILED_ATTEMPTS = 5;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const body = request.body as ResetPasswordBody;
    const username = body.username?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const code = body.code?.trim() || "";
    const newPassword = body.newPassword || "";
    const ip = getClientIp(request);

    if (!username || !email || !code || !newPassword) {
      return response.status(400).json({ error: "Username, email, code, and new password are required." });
    }

    const rateLimitResult = await consumePersistentRateLimit({
      scope: "reset-password",
      key: `${ip}::${username.toLowerCase()}`,
      maxAttempts: RESET_PASSWORD_MAX_ATTEMPTS,
      windowMs: RESET_PASSWORD_WINDOW_MS,
    });
    if (!rateLimitResult.allowed) {
      return response.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return response.status(400).json({ error: passwordError });
    }

    const user = await UserModel.findOne({ username, email });
    if (!user) {
      return response.status(401).json({ error: GENERIC_FAILURE_MESSAGE });
    }

    const resetCodeRecord = await PasswordResetCodeModel.findOne({
      userId: user._id,
      expiresAt: { $gt: new Date() },
    });

    if (!resetCodeRecord) {
      return response.status(401).json({ error: GENERIC_FAILURE_MESSAGE });
    }

    if (resetCodeRecord.failedAttemptCount >= RESET_CODE_MAX_FAILED_ATTEMPTS) {
      await PasswordResetCodeModel.deleteOne({ _id: resetCodeRecord._id });
      return response.status(401).json({ error: GENERIC_FAILURE_MESSAGE });
    }

    if (!isResetCodeMatch(code, resetCodeRecord.codeHash)) {
      resetCodeRecord.failedAttemptCount += 1;
      if (resetCodeRecord.failedAttemptCount >= RESET_CODE_MAX_FAILED_ATTEMPTS) {
        await PasswordResetCodeModel.deleteOne({ _id: resetCodeRecord._id });
      } else {
        await resetCodeRecord.save();
      }
      return response.status(401).json({ error: GENERIC_FAILURE_MESSAGE });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordPepperVersion = getRequiredEnv("PEPPER_VERSION");
    await user.save();

    await PasswordResetCodeModel.deleteMany({ userId: user._id });

    await revokeAllUserSessions(user._id.toString());
    clearSessionCookie(response);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("reset-password error", error);
    return response.status(500).json({ error: "Unable to reset password." });
  }
}