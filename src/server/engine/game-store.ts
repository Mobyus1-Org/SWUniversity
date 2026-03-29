import type { EngineContext } from "@/server/engine/pending-resolution";

/**
 * In-memory server-side store for active game contexts.
 *
 * Keyed by gameId. Attached to `globalThis` so it survives Next.js hot-module
 * reloads in development (module-level variables are re-initialised on each
 * reload, but `globalThis` persists for the lifetime of the Node process).
 *
 * Suitable for development and testing; swap for a persistent store (Redis,
 * DB) in production if needed.
 */

declare global {
  // eslint-disable-next-line no-var
  var __gameStore: Map<string, EngineContext> | undefined;
}

const store: Map<string, EngineContext> =
  globalThis.__gameStore ?? (globalThis.__gameStore = new Map());

export function setContext(gameId: string, context: EngineContext): void {
  store.set(gameId, context);
}

export function getContext(gameId: string): EngineContext | undefined {
  return store.get(gameId);
}

export function deleteContext(gameId: string): void {
  store.delete(gameId);
}
