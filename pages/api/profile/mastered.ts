import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const session = await getSessionFromRequest(request);
    if (!session) {
      return response.status(401).json({ error: "Unauthorized" });
    }

    const profile = await UserProfileModel.findOne({ userId: session.user.id })
      .select("masteredQuizIds masteredDykswuIds")
      .lean();

    return response.status(200).json({
      masteredQuizIds: profile?.masteredQuizIds ?? [],
      masteredDykswuIds: profile?.masteredDykswuIds ?? [],
    });
  } catch (error) {
    console.error("mastered error", error);
    return response.status(500).json({ error: "Unable to load mastered questions" });
  }
}
