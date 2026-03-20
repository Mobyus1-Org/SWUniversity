import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { isGameCompletedBlocked, recordGameCompleted } from "@/server/auth/rate-limit";
import { UserProfileModel } from "@/server/models/UserProfile";
import { serializeUserProfile } from "@/server/profile-response";
import type { DifficultyBreakdown, TrackedApp, TrackedGameMode } from "@/util/profile-data";

type GameCompletedBody = {
  app?: TrackedApp;
  mode?: TrackedGameMode;
  correct?: number;
  total?: number;
  difficultyBreakdown?: DifficultyBreakdown;
};

function isValidDifficultyBreakdown(value: unknown): value is DifficultyBreakdown {
  if (!value || typeof value !== "object") {
    return false;
  }

  const breakdown = value as Record<string, { correct?: number; total?: number }>;
  const keys: Array<keyof DifficultyBreakdown> = ["padawan", "knight", "master"];

  return keys.every((key) => {
    const entry = breakdown[key];
    return !!entry
      && typeof entry.correct === "number"
      && typeof entry.total === "number"
      && entry.correct >= 0
      && entry.total >= 0
      && entry.correct <= entry.total;
  });
}

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

    if (isGameCompletedBlocked(session.user.id)) {
      return response.status(429).json({ error: "Too many requests. Please try again later." });
    }
    recordGameCompleted(session.user.id);

    const body = request.body as GameCompletedBody;
    const { app, mode, correct, total, difficultyBreakdown } = body;

    if (!app || !mode || correct === undefined || total === undefined || !difficultyBreakdown) {
      return response.status(400).json({ error: "app, mode, correct, total, and difficultyBreakdown are required" });
    }

    if (!["quiz", "dykswu"].includes(app)) {
      return response.status(400).json({ error: "Invalid app value" });
    }

    if (!["standard", "iron-man", "padawan", "knight", "master"].includes(mode)) {
      return response.status(400).json({ error: "Invalid mode value" });
    }

    if (typeof correct !== "number" || typeof total !== "number") {
      return response.status(400).json({ error: "correct and total must be numbers" });
    }

    if (correct < 0 || total < 0 || correct > total) {
      return response.status(400).json({ error: "correct must be >= 0 and <= total" });
    }

    if (!isValidDifficultyBreakdown(difficultyBreakdown)) {
      return response.status(400).json({ error: "Invalid difficultyBreakdown value" });
    }

    const profile = await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      {
        $push: {
          gamesCompleted: {
            date: new Date(),
            app,
            mode,
            correct,
            total,
            difficultyBreakdown,
          },
        },
      },
      { new: true, upsert: false },
    );

    if (!profile) {
      return response.status(404).json({ error: "User profile not found" });
    }

    return response.status(200).json({ success: true, profile: serializeUserProfile(profile) });
  } catch (error) {
    console.error("game-completed error", error);
    return response.status(500).json({ error: "Unable to log game completion" });
  }
}
