import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserProfileModel } from "@/server/models/UserProfile";
import { isBadgeId } from "@/server/badges";
import { serializeUserProfile } from "@/server/profile-response";

type AwardBadgeBody = {
  badgeId?: string;
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

    const body = request.body as AwardBadgeBody;
    const { badgeId } = body;

    // Validate badge exists
    if (!badgeId || !isBadgeId(badgeId)) {
      return response.status(400).json({ error: "Invalid badge ID" });
    }

    // Get profile and check if badge already exists
    const profile = await UserProfileModel.findOne({ userId: session.user.id });

    if (!profile) {
      return response.status(404).json({ error: "User profile not found" });
    }

    // Only add if not already present (ensure uniqueness)
    if (!profile.badges.includes(badgeId)) {
      profile.badges.push(badgeId);
      await profile.save();
    }

    return response.status(200).json({ success: true, profile: serializeUserProfile(profile) });
  } catch (error) {
    console.error("award-badge error", error);
    return response.status(500).json({ error: "Unable to award badge" });
  }
}
