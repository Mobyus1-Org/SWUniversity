import type { GetServerSideProps } from "next";
import PuzzlesPage from "@/containers/PuzzlesPage";
import { getSessionFromRequest } from "@/server/auth/session";
import { puzzleAccessLevel } from "@/server/auth/puzzle-access";
import { connectToDatabase } from "@/server/db";
import { UserProfileModel } from "@/server/models/UserProfile";
import type { NextApiRequest } from "next";

async function fetchSolvedPuzzleIds(userId: string): Promise<string[]> {
  try {
    const profile = await UserProfileModel.findOne({ userId }).lean();
    return profile?.solvedPuzzleIds ?? [];
  } catch {
    return [];
  }
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Puzzles is public — everyone (including logged-out visitors) may open this page. Admins get the
  // builder tools; visibility of individual puzzles is enforced server-side by the list endpoint.
  const request = context.req as NextApiRequest;
  const session = await getSessionFromRequest(request);
  const isAdmin = session?.user.role === "admin";

  await connectToDatabase();
  const solvedPuzzleIds = session ? await fetchSolvedPuzzleIds(session.user.id) : [];

  // Same source of truth the list endpoint uses to decide which puzzles to return, so the filter
  // buttons can never offer a status the viewer would only get an empty list for.
  const accessLevel = await puzzleAccessLevel(session);

  return { props: { showBuilderTools: isAdmin, isAdmin, accessLevel, solvedPuzzleIds } };
};

export default PuzzlesPage;
