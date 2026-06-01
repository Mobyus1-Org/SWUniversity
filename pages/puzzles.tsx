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
  const request = context.req as NextApiRequest;
  const session = await getSessionFromRequest(request);

  // Not signed in -> redirect
  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const isAdmin = session.user.role === "admin";

  if (isAdmin) {
    await connectToDatabase();
    const solvedPuzzleIds = await fetchSolvedPuzzleIds(session.user.id);
    return { props: { showBuilderTools: true, isAdmin: true, solvedPuzzleIds } };
  }

  // Not admin — check previewUsers in authz collection
  try {
    const mongoose = await connectToDatabase();
    const coll = mongoose.connection.collection("authz");
    const authz = await coll.findOne({});
    const previewUsers = (authz && Array.isArray((authz as any).previewUsers)) ? (authz as any).previewUsers : [];
    if (previewUsers.includes(session.user.username)) {
      const solvedPuzzleIds = await fetchSolvedPuzzleIds(session.user.id);
      return { props: { showBuilderTools: false, isAdmin: false, solvedPuzzleIds } };
    }
  } catch (err) {
    // fallthrough to redirect
    console.error("authz check failed", err);
  }

  return { redirect: { destination: "/", permanent: false } };
};

export default PuzzlesPage;
