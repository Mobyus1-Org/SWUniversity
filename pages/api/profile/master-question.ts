import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";
import { serializeUserProfile } from "@/server/profile-response";
import type { TrackedApp } from "@/util/profile-data";

type MasterQuestionBody = {
  app?: TrackedApp;
  key?: string;
  keys?: string[];
};

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
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

    const { app, key, keys } = request.body as MasterQuestionBody;

    if (!app || !["quiz", "dykswu"].includes(app)) {
      return response.status(400).json({ error: "Invalid app value" });
    }

    const validKeys = Array.isArray(keys) ? keys.filter((k) => typeof k === "string" && k.length > 0) : [];
    const toAdd = [...(typeof key === "string" && key.length > 0 ? [key] : []), ...validKeys];

    if (toAdd.length === 0) {
      return response.status(400).json({ error: "key or keys is required" });
    }

    const field = app === "quiz" ? "masteredQuizIds" : "masteredDykswuIds";

    const profile = await UserProfileModel.findOneAndUpdate(
      { userId: session.user.id },
      { $addToSet: { [field]: { $each: toAdd } } },
      { new: true, upsert: false },
    );

    if (!profile) {
      return response.status(404).json({ error: "User profile not found" });
    }

    return response.status(200).json({ success: true, profile: serializeUserProfile(profile) });
  } catch (error) {
    console.error("master-question error", error);
    return response.status(500).json({ error: "Unable to record mastered question" });
  }
}
