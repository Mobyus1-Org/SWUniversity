const REQUIRED_ENV_KEYS = [
  "MONGO_CONNECTION_STRING",
  "CRYPTO_PEPPER_CURRENT",
  "PEPPER_VERSION",
  "SESSION_SECRET",
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type OptionalEnvKey = "CRYPTO_PEPPER_PREVIOUS";

export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key] || process.env[key]?.trim() === "");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function getRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getOptionalEnv(key: OptionalEnvKey): string | null {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    return null;
  }

  return value;
}
