import type { NextApiRequest, NextApiResponse } from "next";

import { methodNotAllowed } from "@/server/auth/http";
import {
  clearSessionCookie,
  getSessionFromRequest,
  revokeSessionById,
} from "@/server/auth/session";
import { assertRequiredEnv } from "@/server/env";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, "POST");
  }

  try {
    assertRequiredEnv();
    const session = await getSessionFromRequest(request);
    if (session) {
      await revokeSessionById(session.sessionId);
    }

    clearSessionCookie(response);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("logout error", error);
    clearSessionCookie(response);
    return response.status(200).json({ ok: true });
  }
}
