import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";
import { serializeUserProfile } from "@/server/profile-response";
import type { DifficultyKey, TrackedApp } from "@/util/profile-data";

type EndlessUpdateBody = {
  app?: TrackedApp;
  correct?: boolean;
  difficulty?: DifficultyKey;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();

    const session = await getSessionFromRequest(request);
    if (!session) {
      return response.status(401).json({ error: "Unauthorized" });
    }

    const body = request.body as EndlessUpdateBody;
    const { app, correct, difficulty } = body;

    if (!app || correct === undefined || !difficulty) {
      return response.status(400).json({ error: "app, correct, and difficulty are required" });
    }

    if (!["quiz", "dykswu"].includes(app)) {
      return response.status(400).json({ error: "Invalid app value" });
    }

    if (!["padawan", "knight", "master"].includes(difficulty)) {
      return response.status(400).json({ error: "Invalid difficulty value" });
    }

    if (typeof correct !== "boolean") {
      return response.status(400).json({ error: "correct must be a boolean" });
    }

    const updates: Record<string, number> = {};
    updates[`endlessModeStats.${app}.total`] = 1;
    updates[`endlessModeStats.${app}.difficultyBreakdown.${difficulty}.total`] = 1;

    if (correct) {
      updates[`endlessModeStats.${app}.correct`] = 1;
      updates[`endlessModeStats.${app}.difficultyBreakdown.${difficulty}.correct`] = 1;
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      { $inc: updates },
      { new: true, upsert: false },
    );

    if (!profile) {
      return response.status(404).json({ error: "User profile not found" });
    }

    return response.status(200).json({ success: true, profile: serializeUserProfile(profile) });
  } catch (error) {
    console.error("endless-update error", error);
    return response.status(500).json({ error: "Unable to update endless mode stats" });
  }
}
