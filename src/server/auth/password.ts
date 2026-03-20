import bcrypt from "bcryptjs";

import { getOptionalEnv, getRequiredEnv } from "@/server/env";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const pepper = getRequiredEnv("CRYPTO_PEPPER_CURRENT");
  return bcrypt.hash(password + pepper, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const result = await verifyPasswordWithPepperRotation(password, passwordHash);
  return result.isValid;
}

export type PasswordVerificationResult = {
  isValid: boolean;
  needsRehash: boolean;
};

export async function verifyPasswordWithPepperRotation(
  password: string,
  passwordHash: string,
): Promise<PasswordVerificationResult> {
  const currentPepper = getRequiredEnv("CRYPTO_PEPPER_CURRENT");
  const currentMatches = await bcrypt.compare(password + currentPepper, passwordHash);
  if (currentMatches) {
    return { isValid: true, needsRehash: false };
  }

  const previousPepper = getOptionalEnv("CRYPTO_PEPPER_PREVIOUS");
  if (!previousPepper) {
    return { isValid: false, needsRehash: false };
  }

  const previousMatches = await bcrypt.compare(password + previousPepper, passwordHash);
  if (previousMatches) {
    return { isValid: true, needsRehash: true };
  }

  return { isValid: false, needsRehash: false };
}
