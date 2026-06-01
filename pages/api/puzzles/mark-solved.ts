import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAuthApi } from "@/server/auth/guards";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";

type MarkSolvedBody = {
  puzzleId?: string;
};

type ResponseBody = { success: true } | { error: string };

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse<ResponseBody>,
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const session = await requireAuthApi(request, response);
    if (!session) return;

    const { puzzleId } = request.body as MarkSolvedBody;
    if (!puzzleId || typeof puzzleId !== "string") {
      return response.status(400).json({ error: "Missing puzzleId." });
    }

    await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      { $addToSet: { solvedPuzzleIds: puzzleId } },
      { upsert: true },
    );

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("mark-solved error", error);
    return response.status(500).json({ error: "Failed to mark puzzle solved." });
  }
}
