/**
 * @deprecated Use /api/puzzles instead.
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_request: NextApiRequest, response: NextApiResponse) {
  return response.status(410).json({ error: "This endpoint has been removed. Use /api/puzzles." });
}
