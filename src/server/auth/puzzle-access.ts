import { connectToDatabase } from "@/server/db";
import type { AuthSession } from "@/server/auth/session";
import type { PuzzleAccessLevel } from "@/server/puzzle/puzzle-status";

/** True when `username` is listed in the `previewUsers` array of the single `authz` doc. */
export async function isPreviewUser(username: string): Promise<boolean> {
  try {
    const mongoose = await connectToDatabase();
    const coll = mongoose.connection.collection("authz");
    const authz = (await coll.findOne({})) as unknown as { previewUsers?: unknown } | null;
    const previewUsers = authz && Array.isArray(authz.previewUsers)
      ? (authz.previewUsers as string[])
      : [];
    return previewUsers.includes(username);
  } catch (err) {
    console.error("authz check failed", err);
    return false;
  }
}

/**
 * The viewer's puzzle access level — the single source of truth for which puzzle statuses they may
 * see. Admins see everything; preview users additionally see Test puzzles; everyone else is public.
 */
export async function puzzleAccessLevel(session: AuthSession | null): Promise<PuzzleAccessLevel> {
  if (!session) return "public";
  if (session.user.role === "admin") return "admin";
  return (await isPreviewUser(session.user.username)) ? "preview" : "public";
}
