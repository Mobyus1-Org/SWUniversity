type CountBucket = {
  count: number;
  windowStart: number;
};

const GAME_COMPLETED_WINDOW_MS = 5 * 60 * 1000;
const GAME_COMPLETED_MAX_PER_WINDOW = 20;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

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
setInterval(() => {
  const now = Date.now();

  for (const [key, value] of gameCompletedAttempts.entries()) {
    if (now - value.windowStart > GAME_COMPLETED_WINDOW_MS) {
      gameCompletedAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
