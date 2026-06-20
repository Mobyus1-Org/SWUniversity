import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { canAccessPuzzles } from "@/server/auth/puzzle-access";
import { assertRequiredEnv } from "@/server/env";
import { connectToDatabase } from "@/server/db";
import { UserProfileModel } from "@/server/models/UserProfile";
import { serializeUserProfile } from "@/server/profile-response";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();
    await connectToDatabase();
    const session = await getSessionFromRequest(request);
    if (!session) {
      return response.status(200).json({ user: null });
    }

    // Fetch profile if it exists
    const profile = await UserProfileModel.findOne({ userId: session.user.id }).lean();

    return response.status(200).json({
      user: {
        ...session.user,
        profile: serializeUserProfile(profile),
      },
      canAccessPuzzles: await canAccessPuzzles(session),
    });
  } catch (error) {
    console.error("me error", error);
    return response.status(200).json({ user: null });
  }
}
