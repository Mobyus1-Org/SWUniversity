import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { hydratePuzzleGame, type RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { computePuzzleUiHints, withPuzzleGame } from "@/server/puzzle/adapters/puzzle-bridge";
import type { PuzzleRuntime } from "@/lib/puzzles/types";

const TEST_PUZZLES_DIR = path.join(process.cwd(), "src/server/_test-puzzles");
const FILE_PREFIX = "test-puzzle.";
const FILE_SUFFIX = ".json";

function isDevOrAdmin(): boolean {
  return process.env.NODE_ENV === "development";
}

async function listPuzzleFiles(): Promise<Array<{ n: number; filename: string }>> {
  const files = await readdir(TEST_PUZZLES_DIR);
  return files
    .filter((f) => f.startsWith(FILE_PREFIX) && f.endsWith(FILE_SUFFIX))
    .map((filename) => {
      const n = parseInt(filename.slice(FILE_PREFIX.length, -FILE_SUFFIX.length), 10);
      return { n, filename };
    })
    .filter(({ n }) => Number.isFinite(n))
    .sort((a, b) => a.n - b.n);
}

type ListResponse = { puzzles: Array<{ n: number; filename: string }> };
type LoadResponse = { state: PuzzleRuntime; ui: ReturnType<typeof computePuzzleUiHints> };
type SaveResponse = { n: number; filename: string };
type ErrorResponse = { error: string };
type ResponseBody = ListResponse | LoadResponse | SaveResponse | ErrorResponse;

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody>,
) {
  // Use admin guard in production; allow freely in dev
  if (!isDevOrAdmin()) {
    const session = await requireAdminApi(request, response);
    if (!session) return;
  }

  // GET — list puzzles, or load a specific puzzle by ?n=N
  if (request.method === "GET") {
    const n = request.query.n;
    if (n !== undefined) {
      // Load puzzle n
      const num = parseInt(String(n), 10);
      if (!Number.isFinite(num)) {
        return response.status(400).json({ error: "Invalid puzzle number." });
      }

      try {
        const filename = `${FILE_PREFIX}${num}${FILE_SUFFIX}`;
        const filePath = path.join(TEST_PUZZLES_DIR, filename);
        const raw = JSON.parse(await readFile(filePath, "utf8")) as RawPuzzleGameState;
        const game = hydratePuzzleGame(raw);
        const state: PuzzleRuntime = {
          game,
          history: [],
          log: [`Puzzle ${num} loaded.`],
          status: "playing",
          prompt: null,
        };
        const ui = withPuzzleGame(game, () => computePuzzleUiHints(state));
        return response.status(200).json({ state, ui });
      } catch {
        return response.status(404).json({ error: `Puzzle ${n} not found.` });
      }
    }

    // List all puzzles
    try {
      const puzzles = await listPuzzleFiles();
      return response.status(200).json({ puzzles });
    } catch {
      return response.status(200).json({ puzzles: [] });
    }
  }

  // POST — save a new puzzle (body is the RawGameState)
  if (request.method === "POST") {
    try {
      const raw = request.body as RawPuzzleGameState;
      if (!raw || typeof raw !== "object") {
        return response.status(400).json({ error: "Missing puzzle state in request body." });
      }

      const existing = await listPuzzleFiles().catch(() => []);
      const nextN = existing.length > 0 ? Math.max(...existing.map((e) => e.n)) + 1 : 1;
      const filename = `${FILE_PREFIX}${nextN}${FILE_SUFFIX}`;
      const filePath = path.join(TEST_PUZZLES_DIR, filename);

      await writeFile(filePath, JSON.stringify(raw, null, 2), "utf8");

      return response.status(200).json({ n: nextN, filename });
    } catch (error) {
      console.error("test-puzzles save error", error);
      return response.status(500).json({ error: "Failed to save puzzle." });
    }
  }

  return methodNotAllowed(response, "GET, POST");
}
