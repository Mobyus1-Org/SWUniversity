import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";
import { UserProfileModel } from "@/server/models/UserProfile";
import { serializeUserProfile } from "@/server/profile-response";
import { computeDatabankCompletion } from "@/server/databank-stats";

/**
 * Admin-only read of ANOTHER user's profile, so admin/tools can link straight to it.
 * Returns the same `user` shape as /api/auth/me, so the profile page can render either
 * without a second copy of the view.
 */
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) {
      return; // the guard already sent 401/403
    }

    const username = typeof request.query.username === "string" ? request.query.username.trim() : "";
    if (username === "") {
      return response.status(400).json({ error: "A username is required." });
    }

    await connectToDatabase();

    const user = await UserModel.findOne({ username })
      .select("_id username email role")
      .lean();
    if (!user) {
      return response.status(404).json({ error: "No such user." });
    }

    const profile = await UserProfileModel.findOne({ userId: user._id }).lean();
    const serialized = serializeUserProfile(profile);
    const profileWithDatabank = serialized
      ? {
          ...serialized,
          databankCompletion: await computeDatabankCompletion(
            serialized.masteredQuizIds,
            serialized.masteredDykswuIds,
          ),
        }
      : null;

    return response.status(200).json({
      user: {
        id: String(user._id),
        username: user.username,
        email: user.email,
        role: user.role,
        profile: profileWithDatabank,
      },
    });
  } catch (error) {
    console.error("admin user-profile error", error);
    return response.status(500).json({ error: "Failed to load user profile." });
  }
}
