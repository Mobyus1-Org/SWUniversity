import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import { getSessionFromRequest } from "@/server/auth/session";
import { assertRequiredEnv } from "@/server/env";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    return methodNotAllowed(response, "GET");
  }

  try {
    assertRequiredEnv();
    const session = await getSessionFromRequest(request);
    if (!session) {
      return response.status(200).json({ user: null });
    }

    return response.status(200).json({ user: session.user });
  } catch (error) {
    console.error("me error", error);
    return response.status(200).json({ user: null });
  }
}
