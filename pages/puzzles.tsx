import type { GetServerSideProps } from "next";
import PuzzlesPage from "@/containers/PuzzlesPage";
import { getSessionFromRequest } from "@/server/auth/session";
import type { NextApiRequest } from "next";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSessionFromRequest(context.req as NextApiRequest);
  const isAdmin = process.env.NODE_ENV === "development" || session?.user.role === "admin";
  return { props: { showBuilderTools: isAdmin } };
};

export default PuzzlesPage;
