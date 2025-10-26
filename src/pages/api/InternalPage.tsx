import React from "react";

import { apiQuizCountsAsync } from "./quiz-counts";
import { globalBackgroundStyle } from "../../util/style-const";
import { apiDYKSWUCountsAsync } from "./dykswu-counts";
import type { DYKSWUCounts, QuizCounts } from "./api-const";

function InternalPage() {
  const [quizCounts, setQuizCounts] = React.useState<QuizCounts>();
  const [dykSWUCounts, setDYKSWUCounts] = React.useState<DYKSWUCounts>();
  const [tagSearchFilter, setTagSearchFilter] = React.useState("");

  React.useEffect(() => {
    const fetchData = async () => {
      const qd = await apiQuizCountsAsync();
      const dyk = await apiDYKSWUCountsAsync();
      setQuizCounts(qd);
      setDYKSWUCounts(dyk);
    };
    fetchData();
  }, []);

  const getDifficultyLabel = (difficulty: number) => {
    switch (difficulty) {
      case 0: return { label: "Padawan", color: "text-cyan-800" };
      case 1: return { label: "Knight", color: "text-green-800" };
      case 2: return { label: "Master", color: "text-purple-800" };
      default: return { label: `Difficulty ${difficulty}`, color: "text-gray-600" };
    }
  };

  const filteredTags = React.useMemo(() => {
    if (!quizCounts?.tagCounts) return [];
    return Object.entries(quizCounts.tagCounts).filter(([tag]) =>
      tag.toLowerCase().includes(tagSearchFilter.toLowerCase())
    );
  }, [quizCounts?.tagCounts, tagSearchFilter]);

  return <div className={`${globalBackgroundStyle} border p-4 m-4 4k:p-8 4k:m-8 flex flex-row gap-4 4k:gap-8 h-[80vh]`}>
    <div className="overflow-y-auto border p-8 w-1/2 space-y-6">
      <h1 className="text-2xl xl:text-3xl uwd:!text-4xl 4k:!text-6xl mb-4 4k:mb-8">Quiz Counts</h1>

      {/* Difficulty Counts Section */}
      <div className="space-y-4">
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-200">
          <table className="w-full">
            <thead className="bg-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-md font-medium text-gray-200">Difficulty</th>
                <th className="px-4 py-3 text-center text-md font-medium text-red-400">A</th>
                <th className="px-4 py-3 text-center text-md font-medium text-blue-400">B</th>
                <th className="px-4 py-3 text-center text-md font-medium text-yellow-400">C</th>
                <th className="px-4 py-3 text-center text-md font-medium text-green-400">D</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {quizCounts && [0, 1, 2].map(difficulty => {
                const difficultyData = quizCounts.counts[difficulty] || {};
                const { label, color } = getDifficultyLabel(difficulty);
                return (
                  <tr key={difficulty} className="hover:bg-gray-300">
                    <td className={`px-4 py-3 font-medium ${color}`}>{label}</td>
                    <td className="px-4 py-3 text-center text-red-700">{difficultyData['a'] || 0}</td>
                    <td className="px-4 py-3 text-center text-blue-700">{difficultyData['b'] || 0}</td>
                    <td className="px-4 py-3 text-center text-yellow-700">{difficultyData['c'] || 0}</td>
                    <td className="px-4 py-3 text-center text-green-700">{difficultyData['d'] || 0}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-600">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-200">Total</td>
                <td className="px-4 py-3 text-center font-bold text-gray-200" colSpan={4}>
                  {quizCounts?.totalCount || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tag Counts Section */}
      <div className="space-y-4">
        <h2 className="text-xl xl:text-2xl uwd:!text-3xl 4k:!text-4xl font-semibold">Tag Distribution</h2>

        {/* Search Filter */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search tags..."
            value={tagSearchFilter}
            onChange={(e) => setTagSearchFilter(e.target.value)}
            className="w-full px-4 py-2 bg-gray-400 border border-gray-500 rounded-lg text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Tags Table */}
        <div className="border border-gray-400 rounded-lg overflow-hidden max-h-96 overflow-y-auto bg-gray-200">
          <table className="w-full">
            <thead className="bg-gray-600 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-md font-medium text-gray-200">Tag</th>
                <th className="px-4 py-3 text-right text-md font-medium text-gray-200">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-400">
              {filteredTags.map(([tag, count]) => (
                <tr key={tag} className="hover:bg-gray-200">
                  <td className="px-4 py-2 text-sm text-gray-800">{tag}</td>
                  <td className="px-4 py-2 text-right text-sm text-blue-600 font-medium">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTags.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-600">
              {tagSearchFilter ? "No tags match your search" : "No tags found"}
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="overflow-y-auto border p-8 w-1/2 space-y-6">
      <h1 className="text-2xl xl:text-3xl uwd:!text-4xl 4k:!text-6xl mb-4 4k:mb-8">Do You Know SWU Counts</h1>

      {/* Regular Difficulty Counts Section */}
      <div className="space-y-4">
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-200">
          <table className="w-full">
            <thead className="bg-gray-600">
              <tr>
                <th className="px-4 py-3 text-center text-md font-medium text-gray-200">Padawan</th>
                <th className="px-4 py-3 text-center text-md font-medium text-gray-200">Knight</th>
                <th className="px-4 py-3 text-center text-md font-medium text-gray-200">Master</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {[0, 1, 2].map(difficulty => {
                  const difficultyData = dykSWUCounts?.counts[difficulty] || {};
                  const sortedAnswers = Object.entries(difficultyData).sort(([,a], [,b]) => b - a);
                  return (
                    <td key={difficulty} className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        {sortedAnswers.map(([answer, count]) => (
                          <div key={answer} className="flex justify-between items-center bg-gray-300 px-2 py-1 rounded">
                            <span className={`font-medium ${
                              answer.toUpperCase() === 'A' ? 'text-red-700' :
                              answer.toUpperCase() === 'B' ? 'text-blue-700' :
                              answer.toUpperCase() === 'C' ? 'text-yellow-700' :
                              answer.toUpperCase() === 'D' ? 'text-green-700' :
                              'text-gray-700'
                            }`}>
                              {answer.toUpperCase()}
                            </span>
                            <span className="text-gray-800 font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
            <tfoot className="bg-gray-600">
              <tr>
                <td className="px-4 py-3 text-center font-bold text-gray-200" colSpan={3}>
                  Total: {dykSWUCounts?.totalCount || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Follow-up Counts Section */}
      <div className="space-y-4">
        <h2 className="text-xl xl:text-2xl uwd:!text-3xl 4k:!text-4xl font-semibold">Follow-up Distribution</h2>
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-200">
          <table className="w-full">
            <thead className="bg-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-md font-medium text-gray-200">Difficulty</th>
                <th className="px-4 py-3 text-center text-md font-medium text-red-400">A</th>
                <th className="px-4 py-3 text-center text-md font-medium text-blue-400">B</th>
                <th className="px-4 py-3 text-center text-md font-medium text-yellow-400">C</th>
                <th className="px-4 py-3 text-center text-md font-medium text-green-400">D</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {dykSWUCounts && [0, 1, 2].map(difficulty => {
                const followUpData = dykSWUCounts.counts.followUpCounts[difficulty] || {};
                const { label, color } = getDifficultyLabel(difficulty);
                return (
                  <tr key={difficulty} className="hover:bg-gray-300">
                    <td className={`px-4 py-3 font-medium ${color}`}>{label}</td>
                    <td className="px-4 py-3 text-center text-red-700">{followUpData['a'] || 0}</td>
                    <td className="px-4 py-3 text-center text-blue-700">{followUpData['b'] || 0}</td>
                    <td className="px-4 py-3 text-center text-yellow-700">{followUpData['c'] || 0}</td>
                    <td className="px-4 py-3 text-center text-green-700">{followUpData['d'] || 0}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-600">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-200">Total</td>
                <td className="px-4 py-3 text-center font-bold text-gray-200" colSpan={4}>
                  {dykSWUCounts?.totalFollowUpCount || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Set Counts Section */}
      <div className="space-y-4">
        <h2 className="text-xl xl:text-2xl uwd:!text-3xl 4k:!text-4xl font-semibold">Set Distribution by Difficulty</h2>
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-200">
          <table className="w-full">
            <thead className="bg-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-md font-medium text-gray-200">Set</th>
                <th className="px-4 py-3 text-center text-md font-medium text-cyan-400">Padawan</th>
                <th className="px-4 py-3 text-center text-md font-medium text-green-400">Knight</th>
                <th className="px-4 py-3 text-center text-md font-medium text-purple-400">Master</th>
                <th className="px-4 py-3 text-center text-md font-medium text-gray-200">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-400">
              {dykSWUCounts && Object.keys(dykSWUCounts.counts.set[0] || {}).map(set => {
                const padawanCount = dykSWUCounts.counts.set[0]?.[set as keyof typeof dykSWUCounts.counts.set[0]] || 0;
                const knightCount = dykSWUCounts.counts.set[1]?.[set as keyof typeof dykSWUCounts.counts.set[1]] || 0;
                const masterCount = dykSWUCounts.counts.set[2]?.[set as keyof typeof dykSWUCounts.counts.set[2]] || 0;
                const total = padawanCount + knightCount + masterCount;

                return (
                  <tr key={set} className="hover:bg-gray-300">
                    <td className="px-4 py-2 text-sm font-medium text-gray-800">{set}</td>
                    <td className="px-4 py-2 text-center text-sm text-cyan-700 font-semibold">{padawanCount}</td>
                    <td className="px-4 py-2 text-center text-sm text-green-700 font-semibold">{knightCount}</td>
                    <td className="px-4 py-2 text-center text-sm text-purple-700 font-semibold">{masterCount}</td>
                    <td className="px-4 py-2 text-center text-sm text-gray-800 font-bold">{total}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-600">
              <tr>
                <td className="px-4 py-3 font-bold text-gray-200">Total</td>
                <td className="px-4 py-3 text-center font-bold text-cyan-300">
                  {dykSWUCounts && Object.values(dykSWUCounts.counts.set[0] || {}).reduce((sum, count) => sum + count, 0)}
                </td>
                <td className="px-4 py-3 text-center font-bold text-green-300">
                  {dykSWUCounts && Object.values(dykSWUCounts.counts.set[1] || {}).reduce((sum, count) => sum + count, 0)}
                </td>
                <td className="px-4 py-3 text-center font-bold text-purple-300">
                  {dykSWUCounts && Object.values(dykSWUCounts.counts.set[2] || {}).reduce((sum, count) => sum + count, 0)}
                </td>
                <td className="px-4 py-3 text-center font-bold text-gray-200">
                  {dykSWUCounts?.totalCount || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  </div>;
}

export default InternalPage;