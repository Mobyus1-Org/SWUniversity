import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAdminApi } from "@/server/auth/guards";
import { connectToDatabase } from "@/server/db";
import { PuzzleModel } from "@/server/models/Puzzle";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");

  const session = await requireAdminApi(request, response);
  if (!session) return;

  try {
    await connectToDatabase();
    const { id, deploy } = request.body as { id?: string; deploy?: boolean };
    if (!id || typeof deploy !== "boolean") return response.status(400).json({ error: "id and deploy(boolean) required" });

    const doc = await PuzzleModel.findByIdAndUpdate(id, { deploy }, { new: true, lean: true });
    if (!doc) return response.status(404).json({ error: "Not found" });

    return response.status(200).json({ id: doc._id.toString(), name: doc.name, description: doc.description ?? "", difficulty: doc.difficulty, deploy: doc.deploy, author: doc.author ?? "", inspiredBy: doc.inspiredBy, intendedSolution: doc.intendedSolution ?? [] });
  } catch (err) {
    console.error("deploy toggle error", err);
    return response.status(500).json({ error: "Failed to update deploy flag." });
  }
}
