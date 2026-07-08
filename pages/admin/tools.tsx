/* eslint-disable react-refresh/only-export-components */

import type { GetServerSideProps } from "next";

import AdminToolsPage from "@/containers/admin/AdminToolsPage";
import { requireAdminPage } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    assertRequiredEnv();
  } catch {
    return { redirect: { destination: "/", permanent: false } };
  }

  const deniedResult = await requireAdminPage(context);
  if (deniedResult) {
    return deniedResult;
  }

  return { props: {} };
};

export default AdminToolsPage;
