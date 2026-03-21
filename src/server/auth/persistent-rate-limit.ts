import { AuthRateLimitModel } from "@/server/models/AuthRateLimit";

type ConsumePersistentRateLimitOptions = {
  scope: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
};

export type PersistentRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type PersistentRateLimitKey = {
  scope: string;
  key: string;
};

export async function getPersistentRateLimitStatus(
  identifier: PersistentRateLimitKey,
): Promise<PersistentRateLimitResult> {
  const existing = await AuthRateLimitModel.findOne(identifier)
    .select("blockedUntil")
    .lean();

  if (!existing?.blockedUntil) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterMs = existing.blockedUntil.getTime() - Date.now();
  if (retryAfterMs <= 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

export async function clearPersistentRateLimit(identifier: PersistentRateLimitKey): Promise<void> {
  await AuthRateLimitModel.deleteOne(identifier);
}

export async function consumePersistentRateLimit(
  options: ConsumePersistentRateLimitOptions,
): Promise<PersistentRateLimitResult> {
  const {
    scope,
    key,
    maxAttempts,
    windowMs,
    blockDurationMs = windowMs,
  } = options;
  const now = Date.now();
  const nowDate = new Date(now);
  const windowExpiresAt = new Date(now + Math.max(windowMs, blockDurationMs));

  const existing = await AuthRateLimitModel.findOne({ scope, key });

  if (!existing) {
    await AuthRateLimitModel.create({
      scope,
      key,
      count: 1,
      windowStartedAt: nowDate,
      blockedUntil: null,
      expiresAt: windowExpiresAt,
    });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.blockedUntil && existing.blockedUntil.getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil.getTime() - now) / 1000)),
    };
  }

  const windowExpired = existing.windowStartedAt.getTime() + windowMs <= now;
  if (windowExpired) {
    existing.count = 1;
    existing.windowStartedAt = nowDate;
    existing.blockedUntil = null;
    existing.expiresAt = windowExpiresAt;
    await existing.save();

    return { allowed: true, retryAfterSeconds: 0 };
  }

  const nextCount = existing.count + 1;
  if (nextCount > maxAttempts) {
    existing.count = nextCount;
    existing.blockedUntil = new Date(now + blockDurationMs);
    existing.expiresAt = new Date(now + blockDurationMs);
    await existing.save();

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(blockDurationMs / 1000)),
    };
  }

  existing.count = nextCount;
  existing.expiresAt = windowExpiresAt;
  await existing.save();

  return { allowed: true, retryAfterSeconds: 0 };
}