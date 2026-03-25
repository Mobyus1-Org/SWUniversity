/* eslint-disable react-refresh/only-export-components */

import type { GetServerSideProps } from "next";

import InternalCardCodeGeneratorPage from "@/containers/InternalCardCodeGeneratorPage";
import { requireAdminPage } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (process.env.NODE_ENV !== "development") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  try {
    assertRequiredEnv();
  } catch {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const deniedResult = await requireAdminPage(context);
  if (deniedResult) {
    return deniedResult;
  }

  return { props: {} };
};

export default InternalCardCodeGeneratorPage;