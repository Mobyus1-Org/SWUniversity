import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { puzzleAccessLevel } from "@/server/auth/puzzle-access";
import { MongoDBPuzzleRepository } from "@/server/puzzle/adapters/mongodb-puzzle-repository";
import { devFixturePuzzles } from "@/server/puzzle/dev-fixtures";

const repo = new MongoDBPuzzleRepository();

export type PuzzleSummary = { id: string; name: string };
type SummariesResponse = { puzzles: PuzzleSummary[] };

/**
 * Just the id and display name of every puzzle the viewer may see.
 *
 * The profile page needs names to label solved puzzle ids, and `GET /api/puzzles` would ship the
 * full `initialGamestate` of every puzzle to do it — kilobytes of board state per row, for two
 * fields. Same visibility rules as the full list, so a player never learns a hidden puzzle exists.
 */
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<SummariesResponse>,
) {
  if (request.method !== "GET") return methodNotAllowed(response, "GET");

  try {
    const session = await getSessionFromRequest(request);
    const level = await puzzleAccessLevel(session);
    const puzzles = [...(await repo.list(level)), ...devFixturePuzzles(level)];
    return response.status(200).json({
      puzzles: puzzles.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch {
    // The profile page treats an empty list as "names unavailable" and still shows the count.
    return response.status(200).json({ puzzles: [] });
  }
}
