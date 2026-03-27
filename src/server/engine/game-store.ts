import type { EngineContext } from "./pending-resolution";

/**
 * In-memory server-side store for active game contexts.
 *
 * Keyed by gameId. Used by server-managed endpoints (`/api/engine/new-game`
 * and `/api/engine/dispatch` with context: null) so clients do not need to
 * round-trip the opaque EngineContext.
 *
 * Note: module-level singleton — resets on server restart. Suitable for
 * development and testing; swap for a persistent store (Redis, DB) in
 * production if needed.
 */

const store = new Map<string, EngineContext>();

export function setContext(gameId: string, context: EngineContext): void {
  store.set(gameId, context);
}

export function getContext(gameId: string): EngineContext | undefined {
  return store.get(gameId);
}

export function deleteContext(gameId: string): void {
  store.delete(gameId);
}
