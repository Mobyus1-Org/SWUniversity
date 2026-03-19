import bcrypt from "bcryptjs";

import { getRequiredEnv } from "@/server/env";

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
  const pepper = getRequiredEnv("CRYPTO_PEPPER");
  return bcrypt.hash(password + pepper, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const pepper = getRequiredEnv("CRYPTO_PEPPER");
  return bcrypt.compare(password + pepper, passwordHash);
}
