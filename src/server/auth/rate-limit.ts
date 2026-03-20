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

// --- Signup rate limiting (per IP) ---

type CountBucket = {
  count: number;
  windowStart: number;
};

const SIGNUP_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_MAX_PER_WINDOW = 5;

const signupAttempts = new Map<string, CountBucket>();

export function isSignupBlocked(ip: string): boolean {
  const existing = signupAttempts.get(ip);
  if (!existing) return false;
  if (Date.now() - existing.windowStart > SIGNUP_WINDOW_MS) {
    signupAttempts.delete(ip);
    return false;
  }
  return existing.count >= SIGNUP_MAX_PER_WINDOW;
}

export function recordSignupAttempt(ip: string): void {
  const now = Date.now();
  const existing = signupAttempts.get(ip);
  if (!existing || now - existing.windowStart > SIGNUP_WINDOW_MS) {
    signupAttempts.set(ip, { count: 1, windowStart: now });
    return;
  }
  signupAttempts.set(ip, { count: existing.count + 1, windowStart: existing.windowStart });
}

// --- Game-completed rate limiting (per userId) ---

const GAME_COMPLETED_WINDOW_MS = 5 * 60 * 1000;
const GAME_COMPLETED_MAX_PER_WINDOW = 20;

const gameCompletedAttempts = new Map<string, CountBucket>();

export function isGameCompletedBlocked(userId: string): boolean {
  const existing = gameCompletedAttempts.get(userId);
  if (!existing) return false;
  if (Date.now() - existing.windowStart > GAME_COMPLETED_WINDOW_MS) {
    gameCompletedAttempts.delete(userId);
    return false;
  }
  return existing.count >= GAME_COMPLETED_MAX_PER_WINDOW;
}

export function recordGameCompleted(userId: string): void {
  const now = Date.now();
  const existing = gameCompletedAttempts.get(userId);
  if (!existing || now - existing.windowStart > GAME_COMPLETED_WINDOW_MS) {
    gameCompletedAttempts.set(userId, { count: 1, windowStart: now });
    return;
  }
  gameCompletedAttempts.set(userId, { count: existing.count + 1, windowStart: existing.windowStart });
}

// Prevent unbounded growth when the process is long-lived.
setInterval(() => {
  const now = Date.now();

  for (const [key, value] of loginAttempts.entries()) {
    if (value.lockUntil === 0 && now - WINDOW_MS > 0) {
      loginAttempts.delete(key);
    }
    if (value.lockUntil !== 0 && value.lockUntil < now - WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }

  for (const [key, value] of signupAttempts.entries()) {
    if (now - value.windowStart > SIGNUP_WINDOW_MS) {
      signupAttempts.delete(key);
    }
  }

  for (const [key, value] of gameCompletedAttempts.entries()) {
    if (now - value.windowStart > GAME_COMPLETED_WINDOW_MS) {
      gameCompletedAttempts.delete(key);
    }
  }
}, WINDOW_MS).unref();
