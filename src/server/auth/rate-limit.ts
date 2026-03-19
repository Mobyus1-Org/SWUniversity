type LoginBucket = {
  failures: number;
  lockUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const LOCK_MS = 10 * 60 * 1000;

const loginAttempts = new Map<string, LoginBucket>();

function getBucketKey(ip: string, accountIdentifier: string): string {
  return `${ip}::${accountIdentifier.toLowerCase()}`;
}

export function isLoginBlocked(ip: string, accountIdentifier: string): boolean {
  const key = getBucketKey(ip, accountIdentifier);
  const existing = loginAttempts.get(key);
  if (!existing) {
    return false;
  }

  if (existing.lockUntil && existing.lockUntil > Date.now()) {
    return true;
  }

  if (existing.lockUntil && existing.lockUntil <= Date.now()) {
    loginAttempts.delete(key);
  }

  return false;
}

export function recordLoginFailure(ip: string, accountIdentifier: string): void {
  const key = getBucketKey(ip, accountIdentifier);
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing) {
    loginAttempts.set(key, {
      failures: 1,
      lockUntil: 0,
    });
    return;
  }

  const failureCount = existing.failures + 1;
  if (failureCount >= MAX_FAILURES) {
    loginAttempts.set(key, {
      failures: failureCount,
      lockUntil: now + LOCK_MS,
    });
    return;
  }

  loginAttempts.set(key, {
    failures: failureCount,
    lockUntil: 0,
  });
}

export function clearLoginFailures(ip: string, accountIdentifier: string): void {
  const key = getBucketKey(ip, accountIdentifier);
  loginAttempts.delete(key);
}

// Prevent unbounded growth when the process is long-lived.
setInterval(() => {
  const threshold = Date.now() - WINDOW_MS;
  for (const [key, value] of loginAttempts.entries()) {
    if (value.lockUntil === 0 && threshold > 0) {
      loginAttempts.delete(key);
    }
    if (value.lockUntil !== 0 && value.lockUntil < Date.now() - WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}, WINDOW_MS).unref();
