import React from "react";
import { renderItalicsAndBold, type DoYouKnowSWUQuestion, type Quiz, type UserResponse } from "../../util/func";
import { AudioContext } from "../../util/context";
import { globalBackgroundStyle, type SWUniversityApp } from "../../util/const";

interface IProps {
  app: SWUniversityApp;
  userResponses: UserResponse[];
  currentModeSet: Quiz[] | DoYouKnowSWUQuestion[];
  standardModeLength: number;
  resetQuizMode?: () => void;
  resetDoYouKnowSWUMode?: () => void;
}

export function StandardModeEndScreen({
  app,
  userResponses,
  currentModeSet,
  standardModeLength,
  resetQuizMode,
  resetDoYouKnowSWUMode
}: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  return <div className="text-center m-[10%_10%] lg:m-[1%_10%]">
    <p className="text-2xl md:text-4xl font-bold mb-4 h-16">Quiz Complete! You answered {Object.values(userResponses).filter(response => response.selected === response.correct).length} out of {standardModeLength} questions correctly.</p>
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
    }}>Go Back to Quiz Menu</button>
    <div className={`mt-8 text-left p-8 ${globalBackgroundStyle}`}>
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
                    return <>
                      <p className="font-bold">Card: {renderItalicsAndBold(question.actualCard)}</p>
                      <p>Your answer: <span className={response.selected === response.correct ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{renderItalicsAndBold(response.selected)}</span></p>
                      {response.selected !== response.correct && <p>Correct answer: <span className="text-green-500 font-bold">{renderItalicsAndBold(response.correct)}</span></p>}
                    </>
                  })()
                }
              </div>;
            })
          }
      </div>
    </div>
  </div>;
}
