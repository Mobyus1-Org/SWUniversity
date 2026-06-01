import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { solve } from "@/server/puzzle/solver";
import type { SolverResult } from "@/server/puzzle/solver";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";

type ValidateBody = { puzzle?: unknown };
type ResponseBody = SolverResult | { error: string };

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody>,
) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");

  const session = await requireAdminApi(request, response);
  if (!session) return;

  const { puzzle } = request.body as ValidateBody;
  if (!puzzle || typeof puzzle !== "object" || Array.isArray(puzzle)) {
    return response.status(400).json({ error: "Missing or invalid puzzle in request body." });
  }

  try {
    const result = solve(puzzle as RawPuzzleGameState);
    return response.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to validate puzzle.";
    return response.status(500).json({ error: msg });
  }
}
