import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { connectToDatabase } from "@/server/db";
import { PuzzleModel } from "@/server/models/Puzzle";
import { parsePuzzleStatus, puzzleStatusOf } from "@/server/puzzle/puzzle-status";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");

  const session = await requireAdminApi(request, response);
  if (!session) return;

  try {
    await connectToDatabase();
    const { id } = request.body as { id?: string };
    const status = parsePuzzleStatus((request.body as { status?: unknown }).status);
    if (!id || !status) {
      return response.status(400).json({ error: "id and status (hidden|test|deployed) required" });
    }

    const doc = await PuzzleModel.findByIdAndUpdate(id, { status }, { new: true, lean: true });
    if (!doc) return response.status(404).json({ error: "Not found" });

    return response.status(200).json({
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description ?? "",
      difficulty: doc.difficulty,
      status: puzzleStatusOf(doc),
      author: doc.author ?? "",
      inspiredBy: doc.inspiredBy,
      intendedSolution: doc.intendedSolution ?? [],
    });
  } catch (err) {
    console.error("status update error", err);
    return response.status(500).json({ error: "Failed to update puzzle status." });
  }
}
