import crypto from "crypto";
import { Resend } from "resend";

import { getRequiredEnv } from "@/server/env";

const RESET_CODE_LENGTH = 6;

export function createResetCode(): string {
  const max = 10 ** RESET_CODE_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(RESET_CODE_LENGTH, "0");
}

export function hashResetCode(code: string): string {
  return crypto
    .createHmac("sha256", getRequiredEnv("SESSION_SECRET"))
    .update(code)
    .digest("hex");
}

export function isResetCodeMatch(code: string, expectedHash: string): boolean {
  const providedHash = hashResetCode(code);
  const providedBuffer = Buffer.from(providedHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function sendPasswordResetCodeEmail(
  email: string,
  username: string,
  code: string,
): Promise<void> {
  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const from = getRequiredEnv("RESEND_FROM_EMAIL");

  await resend.emails.send({
    from,
    to: email,
    subject: "SWUniversity password reset code",
    text: [
      `Hello ${username},`,
      "",
      `Your password reset code is: ${code}`,
      "",
      "This code expires in 15 minutes.",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
  });
}

export async function ensureMinimumResetResponseTime(
  startedAt: number,
  minimumMs: number,
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minimumMs) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, minimumMs - elapsed);
  });
}