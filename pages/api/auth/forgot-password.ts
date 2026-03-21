import type { NextApiRequest, NextApiResponse } from "next";

import { getClientIp, methodNotAllowed } from "@/server/auth/http";
import {
  createResetCode,
  ensureMinimumResetResponseTime,
  hashResetCode,
  sendPasswordResetCodeEmail,
} from "@/server/auth/password-reset";
import { consumePersistentRateLimit } from "@/server/auth/persistent-rate-limit";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { PasswordResetCodeModel } from "@/server/models/PasswordResetCode";
import { UserModel } from "@/server/models/User";

type ForgotPasswordBody = {
  username?: string;
  email?: string;
};

const FORGOT_PASSWORD_MIN_RESPONSE_MS = 900;
const RESET_CODE_COOLDOWN_MS = 30 * 1000;
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_MAX_ATTEMPTS = 3;

const GENERIC_SUCCESS_RESPONSE = {
  ok: true,
  message: "If the account details are valid, a reset code has been sent.",
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const requestStartedAt = Date.now();

  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const body = request.body as ForgotPasswordBody;
    const username = body.username?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";

    if (!username || !email) {
      return response.status(400).json({ error: "Username and email are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({ error: "Invalid email address." });
    }

    const ip = getClientIp(request);
    const rateLimitResult = await consumePersistentRateLimit({
      scope: "forgot-password",
      key: ip,
      maxAttempts: FORGOT_PASSWORD_MAX_ATTEMPTS,
      windowMs: FORGOT_PASSWORD_WINDOW_MS,
    });
    if (!rateLimitResult.allowed) {
      return response.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const user = await UserModel.findOne({ username, email }).select("_id username email").lean();
    if (!user) {
      hashResetCode(createResetCode());
      await ensureMinimumResetResponseTime(requestStartedAt, FORGOT_PASSWORD_MIN_RESPONSE_MS);
      return response.status(200).json(GENERIC_SUCCESS_RESPONSE);
    }

    const existingResetCode = await PasswordResetCodeModel.findOne({ userId: user._id })
      .select("lastSentAt")
      .lean();

    if (
      existingResetCode?.lastSentAt
      && Date.now() - new Date(existingResetCode.lastSentAt).getTime() < RESET_CODE_COOLDOWN_MS
    ) {
      // Keep response generic to avoid leaking account existence details.
      await ensureMinimumResetResponseTime(requestStartedAt, FORGOT_PASSWORD_MIN_RESPONSE_MS);
      return response.status(200).json(GENERIC_SUCCESS_RESPONSE);
    }

    const code = createResetCode();
    await PasswordResetCodeModel.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          codeHash: hashResetCode(code),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          lastSentAt: new Date(),
          failedAttemptCount: 0,
        },
      },
      { upsert: true, new: true },
    );

    await sendPasswordResetCodeEmail(user.email, user.username, code);
    await ensureMinimumResetResponseTime(requestStartedAt, FORGOT_PASSWORD_MIN_RESPONSE_MS);

    return response.status(200).json(GENERIC_SUCCESS_RESPONSE);
  } catch (error) {
    console.error("forgot-password error", error);
    await ensureMinimumResetResponseTime(requestStartedAt, FORGOT_PASSWORD_MIN_RESPONSE_MS);
    return response.status(200).json(GENERIC_SUCCESS_RESPONSE);
  }
}