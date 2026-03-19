import type { NextApiRequest, NextApiResponse } from "next";

export function getClientIp(request: NextApiRequest): string {
  const xForwardedFor = request.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0]?.split(",")[0]?.trim() || "unknown";
  }

  return request.socket.remoteAddress || "unknown";
}

export function methodNotAllowed(response: NextApiResponse, allowedMethod: string): void {
  response.setHeader("Allow", allowedMethod);
  response.status(405).json({ error: "Method not allowed" });
}
