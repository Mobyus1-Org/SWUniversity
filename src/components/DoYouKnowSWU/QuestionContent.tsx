import React from "react";
import { DYKSWUChoices, globalBackgroundStyle, type AppModes, type SfxType } from "../../util/const";
import { renderItalicsAndBold, isMarathonVariant, type UserResponse, type DoYouKnowSWUQuestion, getSWUDBImageLink, getDYKSWUImageLink } from "../../util/func";
import { StandardModeEndScreen } from "../Shared/StandardModeEndScreen";
import { MarathonModeEndScreen } from "../Shared/MarathonModeEndScreen";
import { AudioContext } from "../../util/context";

interface IProps {
  currentQuestionSet: DoYouKnowSWUQuestion[];
  currentQuestionId: number;
  questionMode: AppModes;
  questionsCompleted: number[];
  lastEndlessQuestions: number[];
  questionResult: boolean;
  selectedAnswer: string;
  standardQuestionLength: number;
  userResponses: UserResponse[];
  setCurrentQuestionId: (id: number) => void;
  setQuestionResult: (result: boolean) => void;
  setSelectedAnswer: (answer: string) => void;
  setQuestionsCompleted: (completed: number[]) => void;
  setLastEndlessQuestions: (list: number[]) => void;
  setQuestionMode: (mode: AppModes) => void;
  setStandardQuestionLength: (length: number) => void;
  setUserResponses: (responses: UserResponse[]) => void;
  resetCurrentQuestionState: () => void;
  resetDoYouKnowSWUMode: () => void;
}

export function QuestionContent({
  currentQuestionSet,
  currentQuestionId,
  questionMode,
  questionsCompleted,
  lastEndlessQuestions,
  questionResult,
  selectedAnswer,
  standardQuestionLength,
  userResponses,
  setCurrentQuestionId,
  setQuestionResult,
  setSelectedAnswer,
  setQuestionsCompleted,
  setLastEndlessQuestions,
  setUserResponses,
  resetCurrentQuestionState,
  resetDoYouKnowSWUMode
}: IProps) {
  const currentQuestion = currentQuestionSet.find(q => q.id === currentQuestionId);
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => { } };

  if (!currentQuestion) return <p className="text-lg">Loading question...</p>;

  const renderChoices = () => {
    if (currentQuestionSet.length === 0) return null;

    const highlighted = (index: number) => {
      if (!questionResult) return "";
      if (currentQuestion.answer === DYKSWUChoices[index]) return "bg-green-800/50 rounded";
      if (selectedAnswer === DYKSWUChoices[index]) return "bg-red-800/50 rounded";

      return "";
    };

    const renderChoiceTitle = (choice: string) =>
      choice == "hp" ? "HP" : choice.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

    const divs = <div className="grid grid-cols-2 gap-2.5">
    {
      DYKSWUChoices.map((_, index) => (
        <div key={index} className={`${highlighted(index)}`}>
          <button
            type="button"
            className={`w-full text-left px-4 py-2 border rounded-lg hover:bg-slate-700/50 transition-colors
            ${selectedAnswer === DYKSWUChoices[index]
                ? 'border-white bg-slate-600/50'
                : 'border-slate-600'
              }
            ${questionResult
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
              }
          `}
            onClick={() => {
              if (!questionResult) {
                sfx("click");
                setSelectedAnswer(DYKSWUChoices[index]);
              }
            }}
            disabled={questionResult}
          >
            <div className="text-md md:text-lg uwd:!text-3xl 4k:!text-5xl">
              {renderChoiceTitle(DYKSWUChoices[index])}
            </div>
          </button>
        </div>
      ))
    }
    </div>;

    return divs;
  }

  return <div className={`border rounded p-2 ${globalBackgroundStyle}`}>
    {
      isMarathonVariant(questionMode)
      && questionsCompleted.length === currentQuestionSet.length
      && <MarathonModeEndScreen app="dykswu" resetDykSWUMode={resetDoYouKnowSWUMode} />
    }
    {
      questionMode === "standard"
      && questionsCompleted.length === standardQuestionLength
      && <StandardModeEndScreen
        app="dykswu"
        userResponses={userResponses}
        currentModeSet={currentQuestionSet}
        standardModeLength={standardQuestionLength}
        resetDoYouKnowSWUMode={resetDoYouKnowSWUMode}
      />
    }
    {
      questionsCompleted.length < currentQuestionSet.length && <div className={`grid ${globalBackgroundStyle} shadow-md md:grid-cols-[40%_60%] border p-8 rounded gap-4`}>
        {/* Question and choices */}
        <div>
          <p className="mb-2.5 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">Find The Mistake:</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedAnswer !== "") {
              onSubmitAnswer(selectedAnswer, setQuestionResult, sfx);
            }
          }}>
            {renderChoices()}
            {!questionResult && <button type="submit" className="btn btn-primary mt-18 text-lg p-4">Submit Answer</button>}
            {
              questionResult && questionsCompleted.length < currentQuestionSet.length
                ? <button className="btn btn-secondary mt-4 text-lg p-4" onClick={() =>
                  onNextQuestion(questionMode, selectedAnswer, currentQuestionId, currentQuestion.answer.toString(),
                    currentQuestionSet, questionsCompleted, lastEndlessQuestions, standardQuestionLength, userResponses, sfx,
                    setQuestionsCompleted, setCurrentQuestionId, setLastEndlessQuestions, setUserResponses, resetCurrentQuestionState)}>
                  Next Question
                </button>
                : null
            }
          </form>
        </div>
        {/* Images */}
        <div className="flex flex-wrap justify-center items-center gap-4">
          <div className="flex flex-col items-center">
            <p className="mb-2.5 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">Mistaken Card</p>
            <img
              src={getDYKSWUImageLink(currentQuestion.img)}
              alt="SWU card to identify mistake on"
              className="max-h-48 md:max-h-64 lg:max-h-120 uwd:!max-h-180 4k:!max-h-240 rounded shadow-lg"
            />
          </div>
          {
            questionResult && <div className="flex flex-col items-center">
              <p className="mb-2.5 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">Actual Card</p>
              <img
                src={getSWUDBImageLink(currentQuestion.actualCard)}
                alt="SWU card that is correct"
                className="max-h-48 md:max-h-64 lg:max-h-120 uwd:!max-h-180 4k:!max-h-240 rounded shadow-lg"
              />
            </div>
          }
        </div>
        {/* Relevant rule */}
        {
          questionResult && currentQuestion.explanation != " " && <div className="md:col-span-2">
            <p className={`${currentQuestion.answer === selectedAnswer ? "text-green-500" : "text-red-500"} text-xl font-bold mb-4`}>
              {currentQuestion.answer === selectedAnswer ? "Correct!" : "Incorrect!"}
            </p>
            <p className="text-xl mb-2.5 font-bold">Relevant Rules:</p>
            <p className="whitespace-pre-wrap">{renderItalicsAndBold(currentQuestion.explanation)}</p>
          </div>
        }
      </div>
    }
  </div>
}

function onSubmitAnswer(selectedIndex: string, setQuizResult: (result: boolean) => void, sfx: (type: SfxType) => void) {
  if (selectedIndex) {
    setQuizResult(true);
    sfx("confirm");
  }
}

function onNextQuestion(
  questionMode: AppModes,
  selectedAnswer: string,
  currentQuestionId: number,
  currentQuestionAnswer: string,
  currentQuestionSet: DoYouKnowSWUQuestion[],
  questionsCompleted: number[],
  lastEndlessQuizzes: number[],
  standardQuestionLength: number,
  userResponses: UserResponse[],
  sfx: (type: SfxType) => void,
  setQuestionsCompleted: (completed: number[]) => void,
  setCurrentQuestionId: (id: number) => void,
  setLastEndlessQuizzes: (list: number[]) => void,
  setUserResponses: (responses: UserResponse[]) => void,
  resetCurrentQuestionState: () => void
) {
  const endlessThreshold = 5; // Number of recent DYKSWU questions to track in endless mode

  if (isMarathonVariant(questionMode)) {
    const updatedCompleted = [...questionsCompleted];
    if (selectedAnswer === currentQuestionAnswer) {
      updatedCompleted.push(currentQuestionId);
      setQuestionsCompleted(updatedCompleted);
    }
    if (updatedCompleted.length !== currentQuestionSet.length) {
      const availableQuizzes = currentQuestionSet.filter(q => !updatedCompleted.includes(q.id));
      if (availableQuizzes.length > 0) {
        const nextQuestion = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
        setCurrentQuestionId(nextQuestion.id);
        resetCurrentQuestionState();
      }
    }
  } else if (questionMode === "endless") {
    const updatedLastEndless = [...lastEndlessQuizzes, currentQuestionId];
    if (updatedLastEndless.length > endlessThreshold) {
      updatedLastEndless.shift();
    }
    setLastEndlessQuizzes(updatedLastEndless);
    const availableQuestions = currentQuestionSet.filter(q => !updatedLastEndless.includes(q.id));
    if (availableQuestions.length > 0) {
      const nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      setCurrentQuestionId(nextQuestion.id);
      resetCurrentQuestionState();
    }
  } else if (questionMode === "standard") {
    const updatedCompleted = [...questionsCompleted];
    updatedCompleted.push(currentQuestionId);
    setQuestionsCompleted(updatedCompleted);
    const updatedResponses = [...userResponses];
    updatedResponses.push({ modeId: currentQuestionId, selected: selectedAnswer, correct: currentQuestionAnswer });
    setUserResponses(updatedResponses);
    if (updatedCompleted.length < standardQuestionLength) {
      console.log(currentQuestionSet);
      console.log(currentQuestionId, updatedCompleted.length, currentQuestionSet[updatedCompleted.length]);
      setCurrentQuestionId(currentQuestionSet[updatedCompleted.length].id);
      resetCurrentQuestionState();
    }
  }

  sfx("click");
}

