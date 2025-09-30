import React from "react";
import { renderDYKSWUChoiceTitle, renderItalicsAndBold, type DoYouKnowSWUQuestion, type Quiz, type UserResponse } from "../../util/func";
import { AudioContext } from "../../util/context";
import {  globalBackgroundStyleNoShadow } from "../../util/style-const";
import { type SWUniversityApp } from "../../util/const";

interface IProps {
  app: SWUniversityApp;
  userResponses: UserResponse[];
  currentModeSet: Quiz[] | DoYouKnowSWUQuestion[];
  standardModeLength: number;
  ignoreScore: boolean;
  resetQuizMode?: () => void;
  resetDoYouKnowSWUMode?: () => void;
}

export function StandardModeEndScreen({
  app,
  userResponses,
  currentModeSet,
  standardModeLength,
  ignoreScore,
  resetQuizMode,
  resetDoYouKnowSWUMode
}: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };

  const renderPoints = () => {
    const points = userResponses.reduce((acc, response) => {
      if (!response.followUp && response.correct === response.selected) {
        acc += 1;
      }
      else if (response.followUp) {
        if(response.correct === response.selected) {
          acc += 0.5;
          if (response.followUp.followUpCorrect === response.followUp.followUpSelected) {
            acc += 0.5;
          }
        }
      }

      return acc;
    }, 0);

    return "You've Reached the End!" + (ignoreScore ? "" : ` You answered ${points} out of ${standardModeLength} questions correctly.`);
  }

  return <div className="text-center m-[10%_10%] lg:m-[1%_10%]">
    <p className="text-lg md:text-4xl font-bold w-3/4 mx-auto my-4 uwd:my-8">{renderPoints()}</p>
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
      !ignoreScore && <div className={`mt-8 text-left p-8 ${globalBackgroundStyleNoShadow}`}>
        <h1 className="text-xl font-bold mb-4 cursor">Your Answers:</h1>
          <div className="mt-4 max-h-140 overflow-y-scroll">
            {
              userResponses.map((response) => {
                const modeEntry = currentModeSet.find(q => q.id === response.modeId)!;

                return <div key={response.modeId} className="mb-6 p-4 border rounded">
                  {
                    app === "quiz" && (() =>
                    {
                      const quiz = modeEntry as Quiz;
                      return <>
                        <p className="font-bold">Q: {renderItalicsAndBold(quiz.question)}</p>
                        <p>Your answer: <span className={response.selected === response.correct ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{renderItalicsAndBold(quiz.choices[response.selected])}</span></p>
                        {response.selected !== response.correct && <p>Correct answer: <span className="text-green-500 font-bold">{renderItalicsAndBold(quiz.choices[response.correct])}</span></p>}
                      </>
                    })()
                  }
                  {
                    app === "dykswu" && (() =>
                    {
                      const question = modeEntry as DoYouKnowSWUQuestion;
                      const questionVariant = question.variants.find((_, i) => i === response.variant) ?? question.variants[0];
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
                      </>
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
