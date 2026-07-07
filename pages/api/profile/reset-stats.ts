import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { requireAuthApi } from "@/server/auth/guards";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";
import { createEmptyEndlessAppStats } from "@/util/profile-data";
import type { TrackedApp } from "@/util/profile-data";

type ResetStatsBody = { app?: TrackedApp };
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

    const { app } = request.body as ResetStatsBody;
    if (app !== "quiz" && app !== "dykswu") {
      return response.status(400).json({ error: "Invalid app value" });
    }

    await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      {
        $pull: { gamesCompleted: { app } },
        $set: { [`endlessModeStats.${app}`]: createEmptyEndlessAppStats() },
      },
    );

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("reset-stats error", error);
    return response.status(500).json({ error: "Failed to reset stats." });
  }
}
