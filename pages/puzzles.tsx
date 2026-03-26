import type { GetServerSideProps } from "next";
import PuzzlesPage from "@/containers/PuzzlesPage";
import { getSessionFromRequest } from "@/server/auth/session";
import type { NextApiRequest } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const isDev = process.env.NODE_ENV === "development";
  let isAdmin = false;
  if (!isDev) {
    const session = await getSessionFromRequest(context.req as NextApiRequest);
    isAdmin = session?.user.role === "admin";
  }
  return { props: { showBuilderTools: isDev || isAdmin } };
};

export default PuzzlesPage;
