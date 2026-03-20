import React from "react";
import { renderDYKSWUChoiceTitle, renderItalicsAndBold, type DoYouKnowSWUQuestion, type Quiz, type UserResponse } from "@/util/func";
import { AudioContext } from "@/util/context";
import { globalBackgroundStyleNoShadow } from "@/util/style-const";
import { type AppModes, type SWUniversityApp } from "@/util/const";
import { awardBadge, logGameCompletion } from "@/util/profile-api";
import {
  createEmptyDifficultyBreakdown,
  difficultyIndexToKey,
  type DifficultyBreakdown,
  type TrackedGameMode,
} from "@/util/profile-data";

interface IProps {
  app: SWUniversityApp;
  appMode: AppModes;
  userResponses: UserResponse[];
  currentModeSet: Quiz[] | DoYouKnowSWUQuestion[];
  standardModeLength: number;
  ironManFailed: boolean;
  resetQuizMode?: () => void;
  resetDoYouKnowSWUMode?: () => void;
}

function getResponsePoints(response: UserResponse): number {
  if (!response.followUp) {
    return response.correct === response.selected ? 1 : 0;
  }

  if (response.correct !== response.selected) {
    return 0;
  }

  return response.followUp.followUpCorrect === response.followUp.followUpSelected ? 1 : 0.5;
}

function getQuizDifficultyBreakdown(currentModeSet: Quiz[], userResponses: UserResponse[]): DifficultyBreakdown {
  let breakdown = createEmptyDifficultyBreakdown();

  for (const response of userResponses) {
    const quiz = currentModeSet.find((entry) => entry.id === response.modeId);
    if (!quiz) {
      continue;
    }

    const difficulty = difficultyIndexToKey(quiz.difficulty);
    breakdown = {
      ...breakdown,
      [difficulty]: {
        correct: breakdown[difficulty].correct + getResponsePoints(response),
        total: breakdown[difficulty].total + 1,
      },
    };
  }

  return breakdown;
}

function getDYKDifficultyBreakdown(
  currentModeSet: DoYouKnowSWUQuestion[],
  userResponses: UserResponse[],
): DifficultyBreakdown {
  let breakdown = createEmptyDifficultyBreakdown();

  for (const response of userResponses) {
    const question = currentModeSet.find((entry) => entry.id === response.modeId);
    if (!question) {
      continue;
    }

    const variant = question.variants[response.variant ?? 0] ?? question.variants[0];
    const difficulty = difficultyIndexToKey(variant.difficulty);
    breakdown = {
      ...breakdown,
      [difficulty]: {
        correct: breakdown[difficulty].correct + getResponsePoints(response),
        total: breakdown[difficulty].total + 1,
      },
    };
  }

  return breakdown;
}

export function ModeEndScreen({
  app,
  appMode,
  userResponses,
  currentModeSet,
  standardModeLength,
  ironManFailed,
  resetQuizMode,
  resetDoYouKnowSWUMode,
}: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  const syncKeyRef = React.useRef<string | null>(null);

  const points = React.useMemo(
    () => userResponses.reduce((acc, response) => acc + getResponsePoints(response), 0),
    [userResponses],
  );

  const totalQuestions = userResponses.length;

  const difficultyBreakdown = React.useMemo(() => {
    if (app === "quiz") {
      return getQuizDifficultyBreakdown(currentModeSet as Quiz[], userResponses);
    }

    return getDYKDifficultyBreakdown(currentModeSet as DoYouKnowSWUQuestion[], userResponses);
  }, [app, currentModeSet, userResponses]);

  React.useEffect(() => {
    if (appMode === "" || appMode === "endless" || userResponses.length === 0) {
      return;
    }

    const trackedMode = appMode as TrackedGameMode;
    const syncKey = JSON.stringify({
      app,
      appMode,
      ironManFailed,
      points,
      totalQuestions,
      difficultyBreakdown,
    });

    if (syncKeyRef.current === syncKey) {
      return;
    }

    syncKeyRef.current = syncKey;

    void logGameCompletion(app, trackedMode, points, totalQuestions, difficultyBreakdown);

    if (trackedMode === "iron-man" && points === totalQuestions) {
      void awardBadge(app === "quiz" ? "iron_man_quiz_2026" : "iron_man_dykswu_2026");
    }
  }, [app, appMode, difficultyBreakdown, ironManFailed, points, totalQuestions, userResponses.length]);

  const renderPoints = () => {
    return <div>You've Reached the End!
      <br />
      <br />
      {appMode === "standard" && `You scored ${points} out of ${standardModeLength} points.`}
      {appMode === "iron-man" && ironManFailed && `Iron Man concluded. You answered ${points} questions correctly.`}
      {appMode === "iron-man" && !ironManFailed && <div>Congratulations, you completed Iron Man Challenge!<br />You answered all {points} questions correctly!</div>}
    </div>;
  };

  return <div className="text-center m-[10%_10%] lg:m-[1%_10%]">
    <p className="text-lg md:text-4xl font-bold w-3/4 mx-auto my-8 uwd:my-12">{renderPoints()}</p>
    <button className="btn btn-primary text-lg p-4" onClick={() => {
      sfx("confirm");
      switch (app) {
        case "quiz":
          resetQuizMode?.();
          break;
        case "dykswu":
          resetDoYouKnowSWUMode?.();
          break;
        default:
          break;
      }
    }}>Go Back to the Menu</button>
    {
      appMode === "standard" && <div className={`mt-8 text-left p-8 ${globalBackgroundStyleNoShadow}`}>
        <h1 className="text-xl font-bold mb-4 cursor">Your Answers:</h1>
        <div className="mt-4 max-h-140 overflow-y-scroll">
          {
            userResponses.map((response) => {
              const modeEntry = currentModeSet.find((entry) => entry.id === response.modeId)!;

              return <div key={`${response.modeId}-${response.variant ?? 0}-${response.selected}`} className="mb-6 p-4 border rounded">
                {
                  app === "quiz" && (() => {
                    const quiz = modeEntry as Quiz;
                    return <>
                      <p className="font-bold">Q: {renderItalicsAndBold(quiz.question)}</p>
                      <p>Your answer: <span className={response.selected === response.correct ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{renderItalicsAndBold(quiz.choices[response.selected])}</span></p>
                      {response.selected !== response.correct && <p>Correct answer: <span className="text-green-500 font-bold">{renderItalicsAndBold(quiz.choices[response.correct])}</span></p>}
                    </>;
                  })()
                }
                {
                  app === "dykswu" && (() => {
                    const question = modeEntry as DoYouKnowSWUQuestion;
                    const questionVariant = question.variants[response.variant ?? 0] ?? question.variants[0];
                    return <>
                      <p className="font-bold">Card: {renderItalicsAndBold(question.actualCard)}</p>
                      <p>Your answer: <span className={response.selected === response.correct ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{renderDYKSWUChoiceTitle(response.selected)}</span></p>
                      {response.selected !== response.correct && <p>Correct answer: <span className="text-green-500 font-bold">{renderDYKSWUChoiceTitle(response.correct)}</span></p>}
                      {
                        response.followUp && !response.followUp.followUpSelected && <>
                          <p className="mt-2.5 font-bold">Follow-up Question: {renderItalicsAndBold(questionVariant.followUp!.question)}</p>
                          <p>Your answer: <span className="text-gray-500 font-bold">Not reached</span></p>
                          <p>Correct answer: <span className="text-green-500 font-bold">{renderItalicsAndBold(questionVariant.followUp!.choices[response.followUp.followUpCorrect])}</span></p>
                        </>
                      }
                      {
                        response.followUp && response.followUp.followUpSelected && <>
                          <p className="mt-2.5 font-bold">Follow-up Question: {renderItalicsAndBold(questionVariant.followUp!.question)}</p>
                          <p>Your answer: <span className={response.followUp.followUpCorrect === response.followUp.followUpSelected ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{renderItalicsAndBold(questionVariant.followUp!.choices[response.followUp.followUpSelected])}</span></p>
                          {response.followUp.followUpCorrect !== response.followUp.followUpSelected && <p>Correct answer: <span className="text-green-500 font-bold">{renderItalicsAndBold(questionVariant.followUp!.choices[response.followUp.followUpCorrect])}</span></p>}
                        </>
                      }
                    </>;
                  })()
                }
              </div>;
            })
          }
        </div>
      </div>
    }
  </div>;
}
