import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { MongoDBPuzzleRepository } from "@/server/puzzle/adapters/mongodb-puzzle-repository";
import type { PuzzleData } from "@/server/puzzle/puzzle-repository";
import type { GameState } from "@/lib/engine/game";

const repo = new MongoDBPuzzleRepository();

function isDevOrAdmin(): boolean {
  return process.env.NODE_ENV === "development";
}

type ListResponse = { puzzles: PuzzleData[] };
type LoadResponse = { gameState: GameState };
type ErrorResponse = { error: string };
type ResponseBody = ListResponse | LoadResponse | PuzzleData | ErrorResponse;

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody>,
) {
  if (!isDevOrAdmin()) {
    const session = await requireAdminApi(request, response);
    if (!session) return;
  }

  // GET — list puzzles, or load a specific puzzle by ?filename=X
  if (request.method === "GET") {
    const filename = request.query.filename;
    if (filename !== undefined) {
      try {
        const raw = await repo.load(String(filename));
        const gameState = hydratePuzzleGame(raw);
        return response.status(200).json({ gameState });
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

  // POST — save a puzzle
  if (request.method === "POST") {
    try {
      const puzzle = request.body as PuzzleData;
      if (!puzzle || typeof puzzle !== "object" || !puzzle.initialGamestate) {
        return response.status(400).json({ error: "Missing or invalid puzzle in request body." });
      }
      const saved = await repo.save(puzzle);
      return response.status(200).json(saved);
    } catch (error) {
      console.error("test-puzzles save error", error);
      return response.status(500).json({ error: "Failed to save puzzle." });
    }
  }

  return methodNotAllowed(response, "GET, POST");
}
