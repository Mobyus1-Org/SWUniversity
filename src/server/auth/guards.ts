import type { NextApiRequest, NextApiResponse } from "next";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";

import { getSessionFromRequest, type AuthSession } from "@/server/auth/session";

export async function requireAuthApi(
  request: NextApiRequest,
  response: NextApiResponse,
): Promise<AuthSession | null> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    response.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return session;
}

export async function requireAdminApi(
  request: NextApiRequest,
  response: NextApiResponse,
): Promise<AuthSession | null> {
  const session = await requireAuthApi(request, response);
  if (!session) {
    return null;
  }

  if (session.user.role !== "admin") {
    response.status(403).json({ error: "Forbidden" });
    return null;
  }

  return session;
}

export async function requireAdminPage(
  context: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<Record<string, never>> | null> {
  const request = context.req as NextApiRequest;
  const session = await getSessionFromRequest(request);

  if (!session) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  if (session.user.role !== "admin") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return null;
}
