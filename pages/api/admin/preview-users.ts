import type { NextApiRequest, NextApiResponse } from "next";
import type { Collection } from "mongodb";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type AuthzDoc = { previewUsers?: string[] };

async function readPreviewUsers(coll: Collection<AuthzDoc>): Promise<string[]> {
  const doc = await coll.findOne({});
  return doc && Array.isArray(doc.previewUsers) ? doc.previewUsers : [];
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (!["GET", "POST", "DELETE"].includes(request.method || "")) {
    return methodNotAllowed(response, "GET, POST, DELETE");
  }

  try {
    assertRequiredEnv();

    const session = await requireAdminApi(request, response);
    if (!session) {
      return;
    }

    const mongoose = await connectToDatabase();
    const coll = mongoose.connection.collection<AuthzDoc>("authz");

    if (request.method === "GET") {
      return response.status(200).json({ previewUsers: await readPreviewUsers(coll) });
    }

    const { username } = request.body as { username?: string };
    const trimmed = typeof username === "string" ? username.trim() : "";
    if (trimmed.length === 0) {
      return response.status(400).json({ error: "username is required" });
    }

    if (request.method === "POST") {
      const existing = await UserModel.findOne({ username: trimmed }).select("_id").lean();
      if (!existing) {
        return response.status(404).json({ error: "No such registered user." });
      }
      await coll.updateOne({}, { $addToSet: { previewUsers: trimmed } }, { upsert: true });
    } else {
      await coll.updateOne({}, { $pull: { previewUsers: trimmed } });
    }

    return response.status(200).json({ previewUsers: await readPreviewUsers(coll) });
  } catch (error) {
    console.error("admin preview-users error", error);
    return response.status(500).json({ error: "Failed to update preview users." });
  }
}
