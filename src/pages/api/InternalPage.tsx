import React from "react";

import { apiQuizCountsAsync } from "./quiz-counts";
import { globalBackgroundStyle } from "../../util/style-const";
import { apiDYKSWUCountsAsync } from "./dykswu-counts";
import type { DYKSWUCounts, QuizCounts } from "./api-const";

function InternalPage() {
  const [quizCounts, setQuizCounts] = React.useState<QuizCounts>();
  const [dykSWUCounts, setDYKSWUCounts] = React.useState<DYKSWUCounts>();

  React.useEffect(() => {
    const fetchData = async () => {
      const qd = await apiQuizCountsAsync();
      const dyk = await apiDYKSWUCountsAsync();
      setQuizCounts(qd);
      setDYKSWUCounts(dyk);
    };
    fetchData();
  }, []);

  return <div className={`${globalBackgroundStyle} border p-4 m-4 4k:p-8 4k:m-8 flex flex-row gap-4 4k:gap-8 h-[80vh]`}>
    <div className="overflow-y-auto border p-8 w-1/2">
      <h1 className="text-2xl xl:text-3xl uwd:!text-4xl 4k:!text-6xl mb-4 4k:mb-8">Quiz Counts</h1>
      <pre>{JSON.stringify(quizCounts, null, 2)}</pre>
    </div>
    <div className="overflow-y-auto border p-8 w-1/2">
      <h1 className="text-2xl xl:text-3xl uwd:!text-4xl 4k:!text-6xl mb-4 4k:mb-8">Do You Know SWU Counts</h1>
      <pre>{JSON.stringify(dykSWUCounts, null, 2)}</pre>
    </div>
    <br />
  </div>;
}

export default InternalPage;