import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { MongoDBPuzzleRepository } from "@/server/puzzle/adapters/mongodb-puzzle-repository";
import { SetGame } from "@/server/engine/core-functions";
import { hydrateGame, computeSentinelPlayIds } from "@/server/engine/dispatch-listener";
import type { PuzzleData } from "@/server/puzzle/puzzle-repository";
import type { GameState, Game } from "@/lib/engine/game";

const repo = new MongoDBPuzzleRepository();

type ListResponse = { puzzles: PuzzleData[] };
type LoadResponse = { gameState: GameState; sentinelPlayIds: string[] };
type ErrorResponse = { error: string };
type ResponseBody = ListResponse | LoadResponse | PuzzleData | ErrorResponse;

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody>,
) {
  // GET — list puzzles, or load a specific puzzle by ?id=X (public)
  if (request.method === "GET") {
    const id = request.query.id;
    if (id !== undefined) {
      try {
        const raw = await repo.load(String(id));
        const gameState = hydratePuzzleGame(raw);
        const tempGame: Game = { id: "", currentGameState: structuredClone(gameState), gameStateHistory: [], gameLog: [] };
        hydrateGame(tempGame);
        SetGame(tempGame);
        const sentinelPlayIds = computeSentinelPlayIds(tempGame.currentGameState);
        SetGame(null);
        return response.status(200).json({ gameState, sentinelPlayIds });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Not found.";
        return response.status(404).json({ error: msg });
      }
    }

    try {
      const puzzles = await repo.list();
      return response.status(200).json({ puzzles });
    } catch {
      return response.status(200).json({ puzzles: [] });
    }
  }

  // POST — save a puzzle (admin only)
  if (request.method === "POST") {
    if (process.env.NODE_ENV !== "development") {
      const session = await requireAdminApi(request, response);
      if (!session) return;
    }

    try {
      const puzzle = request.body as PuzzleData;
      if (!puzzle || typeof puzzle !== "object" || !puzzle.initialGamestate) {
        return response.status(400).json({ error: "Missing or invalid puzzle in request body." });
      }
      const saved = await repo.save(puzzle);
      return response.status(200).json(saved);
    } catch (error) {
      console.error("puzzle save error", error);
      return response.status(500).json({ error: "Failed to save puzzle." });
    }
  }

  return methodNotAllowed(response, "GET, POST");
}
