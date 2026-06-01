import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAuthApi } from "@/server/auth/guards";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";

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

    await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { solvedPuzzleIds: [] } },
    );

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("reset-puzzle-completion error", error);
    return response.status(500).json({ error: "Failed to reset puzzle completion." });
  }
}
