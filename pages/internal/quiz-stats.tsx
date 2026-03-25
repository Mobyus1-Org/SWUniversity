/* eslint-disable react-refresh/only-export-components */

import QuizStatsPage from "@/containers/InternalPage";
import type { GetServerSideProps } from "next";

import { requireAdminPage } from "@/server/auth/guards";
import { assertRequiredEnv } from "@/server/env";

export const getServerSideProps: GetServerSideProps = async (context) => {
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

export default QuizStatsPage;