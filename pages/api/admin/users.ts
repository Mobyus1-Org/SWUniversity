import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) {
      return;
    }

    await connectToDatabase();

    const users = await UserModel.find({ passwordPepperVersion: { $ne: "v1-dev" } })
      .select("username email role createdAt")
      .sort({ username: 1 })
      .lean();

    return response.status(200).json({
      users: users.map((user) => ({
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error("admin users error", error);
    return response.status(500).json({ error: "Failed to load users." });
  }
}
