import type { GetServerSideProps } from "next";
import PuzzlesPage from "@/containers/PuzzlesPage";
import { getSessionFromRequest } from "@/server/auth/session";
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

  return { props: { showBuilderTools: isAdmin, isAdmin, solvedPuzzleIds } };
};

export default PuzzlesPage;
