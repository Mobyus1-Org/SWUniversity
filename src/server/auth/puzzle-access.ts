import { connectToDatabase } from "@/server/db";
import type { AuthSession } from "@/server/auth/session";

/**
 * Whether the given session may access Puzzles. Access is granted to admins and
 * to "preview" users — usernames listed in the `previewUsers` array of the
 * single document in the `authz` collection.
 *
 * This is the single source of truth for the admin-or-preview gate used by the
 * /puzzles page guard, the profile page, /api/auth/me, and the nav button.
 */
export async function canAccessPuzzles(session: AuthSession | null): Promise<boolean> {
  if (!session) {
    return false;
  }
  if (session.user.role === "admin") {
    return true;
  }

  try {
    const mongoose = await connectToDatabase();
    const coll = mongoose.connection.collection("authz");
    const authz = (await coll.findOne({})) as unknown as { previewUsers?: unknown } | null;
    const previewUsers = authz && Array.isArray(authz.previewUsers)
      ? (authz.previewUsers as string[])
      : [];
    return previewUsers.includes(session.user.username);
  } catch (err) {
    console.error("authz check failed", err);
    return false;
  }
}
