import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminApi } from "@/server/auth/guards";
import { methodNotAllowed } from "@/server/auth/http";
import { connectToDatabase } from "@/server/db";
import { assertRequiredEnv, getOptionalEnv, getRequiredEnv } from "@/server/env";
import { UserModel } from "@/server/models/User";

type SecurityReportResponse = {
  activePepperVersion: string;
  totalUsers: number;
  usersOnActivePepperVersion: number;
  usersNotOnActivePepperVersion: number;
  usersWithoutPepperVersion: number;
  hasPreviousPepperConfigured: boolean;
  migrationWindowOpen: boolean;
};

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

    const activePepperVersion = getRequiredEnv("PEPPER_VERSION");

    await connectToDatabase();

    const [totalUsers, usersOnActivePepperVersion, usersWithoutPepperVersion] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ passwordPepperVersion: activePepperVersion }),
      UserModel.countDocuments({
        $or: [
          { passwordPepperVersion: { $exists: false } },
          { passwordPepperVersion: null },
          { passwordPepperVersion: "" },
        ],
      }),
    ]);

    const usersNotOnActivePepperVersion = totalUsers - usersOnActivePepperVersion;

    const hasPreviousPepperConfigured = Boolean(getOptionalEnv("CRYPTO_PEPPER_PREVIOUS"));

    const payload: SecurityReportResponse = {
      activePepperVersion,
      totalUsers,
      usersOnActivePepperVersion,
      usersNotOnActivePepperVersion,
      usersWithoutPepperVersion,
      hasPreviousPepperConfigured,
      migrationWindowOpen: hasPreviousPepperConfigured,
    };

    return response.status(200).json(payload);
  } catch (error) {
    console.error("internal security report error", error);
    return response.status(500).json({ error: "Unable to load security report." });
  }
}
