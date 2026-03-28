import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";
import type { Game } from "@/lib/engine/game";

/**
 * Pluggable transport layer between any consumer (UI, tests) and the game engine.
 *
 * - InProcessTransport  — same process; used by unit tests and server-side code
 * - HttpTransport        — over HTTP; used by any external UI client
 *
 * Implementations receive the shared Game reference in their constructor so they
 * can mutate it in-place after each dispatch, allowing consumers to read
 * updated state immediately from their existing Game reference.
 */
export interface EngineTransport {
  sendDispatchAsync(dispatch: GameDispatch): Promise<DispatchResponse>;
}

/**
 * Factory function passed to EngineConnector.
 * Receives the newly-created Game object so the transport can hold a shared
 * reference to it and keep state in sync after every dispatch.
 */
export type TransportFactory = (game: Game) => EngineTransport;
