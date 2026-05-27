import type { GetServerSideProps } from "next";
import PuzzlesPage from "@/containers/PuzzlesPage";
import { getSessionFromRequest } from "@/server/auth/session";
import { connectToDatabase } from "@/server/db";
import type { NextApiRequest } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const request = context.req as NextApiRequest;
  const session = await getSessionFromRequest(request);

  // Not signed in -> redirect
  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const isAdmin = session.user.role === "admin";

  if (isAdmin) return { props: { showBuilderTools: true, isAdmin: true } };

  // Not admin — check previewUsers in authz collection
  try {
    const mongoose = await connectToDatabase();
    const coll = mongoose.connection.collection("authz");
    const authz = await coll.findOne({});
    const previewUsers = (authz && Array.isArray((authz as any).previewUsers)) ? (authz as any).previewUsers : [];
    if (previewUsers.includes(session.user.username)) {
      return { props: { showBuilderTools: false, isAdmin: false } };
    }
  } catch (err) {
    // fallthrough to redirect
    console.error("authz check failed", err);
  }

  return { redirect: { destination: "/", permanent: false } };
};

export default PuzzlesPage;
