import React from "react";

import { globalBackgroundStyle, globalBackgroundStyleBigShadow, getLightsaberGlowHover } from "../../util/style-const";
import { DYKSWUChoices, type AppModes, type SfxType } from "../../util/const";
import { renderItalicsAndBold, type UserResponse, type DoYouKnowSWUQuestion, getSWUDBImageLink, getSWUDBImageLinkFallback, getDYKSWUImageLink, getDYKSWUImageLinkFallback, renderDYKSWUChoiceTitle, type DoYouKnowSWUVariant } from "../../util/func";
import { ModeEndScreen } from "../Shared/ModeEndScreen";
import { AudioContext, UserSettingsContext } from "../../util/context";

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
  currentFollowUpKeys: string[];
  currentVariant: number;
  questionsEnded: boolean;
  setCurrentQuestionId: React.Dispatch<React.SetStateAction<number>>;
  setQuestionResult: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAnswer: React.Dispatch<React.SetStateAction<string>>;
  setQuestionsCompleted: React.Dispatch<React.SetStateAction<number[]>>;
  setLastEndlessQuestions: React.Dispatch<React.SetStateAction<number[]>>;
  setQuestionMode: React.Dispatch<React.SetStateAction<AppModes>>;
  setStandardQuestionLength: React.Dispatch<React.SetStateAction<number>>;
  setUserResponses: React.Dispatch<React.SetStateAction<UserResponse[]>>;
  resetCurrentQuestionState: () => void;
  resetDoYouKnowSWUMode: () => void;
  setCurrentFollowUpKeys: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentVariant: React.Dispatch<React.SetStateAction<number>>;
  setQuestionsEnded: React.Dispatch<React.SetStateAction<boolean>>;
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
  currentFollowUpKeys,
  currentVariant,
  questionsEnded,
  setCurrentQuestionId,
  setQuestionResult,
  setSelectedAnswer,
  setQuestionsCompleted,
  setLastEndlessQuestions,
  setUserResponses,
  resetCurrentQuestionState,
  resetDoYouKnowSWUMode,
  setCurrentFollowUpKeys,
  setCurrentVariant,
  setQuestionsEnded
}: IProps) {
  const currentQuestion = currentQuestionSet.find(q => q.id === currentQuestionId)!;
  const currentVariantQuestion = currentQuestion.variants[currentVariant];
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => { } };
  const userSettings = React.useContext(UserSettingsContext);
  const [revealCard, setRevealCard] = React.useState(false);
  const [followUpAnswer, setFollowUpAnswer] = React.useState<string>("");
  const [followUpSubmitted, setFollowUpSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (questionResult) {
      setRevealCard(true);
    } else {
      setRevealCard(false);
    }
  }, [questionResult])

  React.useEffect(() => {
      setCurrentFollowUpKeys([]);
    }, [currentQuestionId, setCurrentFollowUpKeys]);

    React.useEffect(() => {
      if(currentVariantQuestion && currentVariantQuestion.followUp && currentFollowUpKeys.length === 0) {
        const choiceKeys = Object.keys(currentVariantQuestion.followUp.choices);
        for (let i = choiceKeys.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choiceKeys[i], choiceKeys[j]] = [choiceKeys[j], choiceKeys[i]];
        }
        setCurrentFollowUpKeys(choiceKeys);
      }
    }, [currentVariantQuestion, currentFollowUpKeys.length, setCurrentFollowUpKeys]);

  if (!currentQuestion) return <p className="text-lg">Loading question...</p>;

  const currentHover = getLightsaberGlowHover(userSettings?.lightsaberColor || 'blue');
  const showFirstChoices = !currentVariantQuestion.followUp
    || (currentVariantQuestion.followUp && !questionResult)
    || (currentVariantQuestion.followUp && !followUpSubmitted && selectedAnswer !== currentVariantQuestion.answer);
  const showFollowUpChoices = questionResult && currentVariantQuestion.followUp && selectedAnswer === currentVariantQuestion.answer;
  const showAnswer = questionResult && (
    !currentVariantQuestion.followUp
    || currentVariantQuestion.followUp && !followUpSubmitted && selectedAnswer !== currentVariantQuestion.answer
  );
  const showFollowUpAnswer = questionResult && currentVariantQuestion.followUp && followUpSubmitted;
  const showExplanation = !currentVariantQuestion.followUp
    || (currentVariantQuestion.followUp && !followUpSubmitted && currentVariantQuestion.answer !== selectedAnswer);

  const renderChoices = () => {
    if (currentQuestionSet.length === 0) return null;

    const highlighted = (index: number) => {
      if (!questionResult) return "";
      if (currentVariantQuestion.answer === DYKSWUChoices[index]) return "bg-green-800/50 rounded";
      if (selectedAnswer === DYKSWUChoices[index]) return "bg-red-800/50 rounded";

      return "";
    };

    const divs = <div className="grid grid-cols-2 gap-2.5 uwd:gap-3.8 4k:gap-5">
      {
        showFirstChoices && DYKSWUChoices.map((_, index) => <div key={"choice-" + index} className={`${highlighted(index)}`}>
          <button
            type="button"
            className={`w-full text-left px-4 uwd:px-8 py-2 uwd:py-4 4k:px-16 4k:py-8 border rounded-lg hover:bg-slate-700/50 ${currentHover}
              ${selectedAnswer === DYKSWUChoices[index] ? 'border-white bg-slate-600/50' : 'border-slate-600'}
              ${questionResult ? 'cursor-not-allowed' : 'cursor-pointer'}
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
              {renderDYKSWUChoiceTitle(DYKSWUChoices[index])}
            </div>
          </button>
        </div>)
      }
      {
        currentVariantQuestion.followUp && showFollowUpChoices && <div className="col-span-2">
          <p className="mb-2.5 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">{renderItalicsAndBold(currentVariantQuestion.followUp.question)}</p>
          <div className="grid grid-cols-1 gap-2.5 uwd:gap-3.8 4k:gap-5">
          {
            currentFollowUpKeys.length > 0 && currentFollowUpKeys.map((key, index) => {
              const highlighted = () => {
                if (!followUpSubmitted) return "";
                if (currentVariantQuestion.followUp!.answer === key) return "bg-green-800/50 rounded";
                if (followUpAnswer === key) return "bg-red-800/50 rounded";
                return "";
              }

              return <div key={"follow-up-" + index} className={`${highlighted()}`}>
              <button
                type="button"
                className={`w-full text-left px-4 uwd:px-8 py-2 uwd:py-4 4k:px-16 4k:py-8 border rounded-lg hover:bg-slate-700/50 ${currentHover}
                  ${followUpAnswer === key ? 'border-white bg-slate-600/50' : 'border-slate-600'}
                  ${followUpSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => {
                  sfx("click");
                  setFollowUpAnswer(key);
                }}
              >
                <div className="text-md md:text-lg uwd:!text-3xl 4k:!text-5xl">
                  {renderItalicsAndBold(currentVariantQuestion.followUp!.choices[key])}
                </div>
              </button>
            </div>})
          }
          </div>
          {
            !followUpSubmitted &&<button
              type="button"
              className={`btn btn-primary mt-20 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}
                ${followUpAnswer === "" ? "opacity-50 cursor-not-allowed" : ""}
              `}
              onClick={() => {
                  setFollowUpSubmitted(true);
                  sfx("confirm");
              }}
              disabled={followUpAnswer === ""}
            >
              Submit Follow-Up Answer
            </button>
          }
        </div>
      }
      {
        currentVariantQuestion.followUp && showFollowUpAnswer && <div className="col-span-2">
          <button className={`btn btn-secondary mt-18 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}`} onClick={() =>
            onNextQuestion(questionMode, selectedAnswer, currentQuestionId, currentVariantQuestion,
              currentQuestionSet, questionsCompleted, lastEndlessQuestions, standardQuestionLength, userResponses,
              followUpSubmitted, followUpAnswer,
              sfx,
              setQuestionsCompleted, setCurrentQuestionId, setLastEndlessQuestions, setUserResponses,
              resetCurrentQuestionState, setFollowUpSubmitted, setFollowUpAnswer, setCurrentVariant, setQuestionsEnded)}>
            Next Question
          </button>
          <p className={`text-xl font-bold mt-4 uwd:mt-8 4k:mt-10 ${followUpAnswer === currentVariantQuestion.followUp.answer ? "text-green-500" : "text-red-500"} `}>
            {followUpAnswer === currentVariantQuestion.followUp.answer ? "Correct!" : "Incorrect!"}
            {questionMode === "iron-man" && followUpAnswer === currentVariantQuestion.followUp.answer && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-green-600 mt-2">
                ({questionsCompleted.length + 1}/{currentQuestionSet.length} total)
              </span>
            )}
            {questionMode === "standard" && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-gray-400 mt-2">
                Question {questionsCompleted.length + 1} of {standardQuestionLength} ({userResponses.filter(r => r.selected === r.correct && (!r.followUp || r.followUp.followUpSelected === r.followUp.followUpCorrect)).length + (selectedAnswer === currentVariantQuestion.answer && followUpAnswer === currentVariantQuestion.followUp.answer ? 1 : 0)} correct)
              </span>
            )}
          </p>
          <p className="whitespace-pre-wrap">{renderItalicsAndBold(currentVariantQuestion.explanation)}</p>
        </div>
      }
    </div>;

    return divs;
  }

  return <div className={`p-2 border rounded ${globalBackgroundStyleBigShadow}`}>
  {
    (questionMode !== "" && questionsCompleted.length === currentQuestionSet.length
      || questionMode === "iron-man" && questionsEnded)
    && <ModeEndScreen
      app="dykswu"
      appMode={questionMode}
      userResponses={userResponses}
      currentModeSet={currentQuestionSet}
      standardModeLength={standardQuestionLength}
      ironManFailed={questionsEnded}
      resetDoYouKnowSWUMode={resetDoYouKnowSWUMode}
    />
  }
  {
     !questionsEnded && questionsCompleted.length < currentQuestionSet.length && <div className={`grid ${globalBackgroundStyle} shadow-md md:grid-cols-[40%_60%] border p-8 rounded gap-4`}>
      {/* Question and choices */}
      <div>
        {!showFollowUpChoices && !followUpSubmitted && <p className="mb-2.5 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">What's been changed?</p>}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (selectedAnswer !== "") {
            onSubmitAnswer(selectedAnswer, setQuestionResult, sfx);
          }
        }}>
          {renderChoices()}
          {!questionResult && <button type="submit" className={`btn btn-primary mt-18 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}`}>Submit Answer</button>}
          {
            showAnswer && questionsCompleted.length < currentQuestionSet.length
              ? <button className={`btn btn-secondary mt-18 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}`} onClick={() =>
                onNextQuestion(questionMode, selectedAnswer, currentQuestionId, currentVariantQuestion,
                  currentQuestionSet, questionsCompleted, lastEndlessQuestions, standardQuestionLength, userResponses,
                  followUpSubmitted, followUpAnswer,
                  sfx,
                  setQuestionsCompleted, setCurrentQuestionId, setLastEndlessQuestions, setUserResponses,
                  resetCurrentQuestionState, setFollowUpSubmitted, setFollowUpAnswer, setCurrentVariant, setQuestionsEnded)}>
                Next Question
              </button>
              : null
          }
        </form>
      </div>
      {/* Images */}
      <div className="flex flex-wrap justify-center items-center gap-4">
        <div className="flex flex-col items-center">
          <p className="h-8 uwd:h-18 4k:h-32 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">Real?</p>
          <img
            src={getDYKSWUImageLink(currentVariantQuestion.img)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Prevent infinite loop
              target.src = getDYKSWUImageLinkFallback(currentVariantQuestion.img);
            }}
            alt="Potentially changed SWU card"
            className="max-h-48 md:max-h-64 lg:max-h-120 uwd:!max-h-180 4k:!max-h-240 rounded shadow-lg"
          />
        </div>
        <div className="flex flex-col items-center">
          <p className="h-8 uwd:h-18 4k:h-32 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">Real Card</p>
          <img
            src={(showAnswer || showFollowUpAnswer) ? getSWUDBImageLink(currentQuestion.actualCard) : "/assets/SWUniversity_Cardback.png"}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Prevent infinite loop
              target.src = getSWUDBImageLinkFallback(currentQuestion.actualCard);
            }}
            alt={(showAnswer || showFollowUpAnswer) ? "Real Card" : "SWUniversity Cardback"}
            className={`max-h-48 md:max-h-64 lg:max-h-120 uwd:!max-h-180 4k:!max-h-240 4k:ml-16 rounded shadow-lg transition-all duration-500 ${(revealCard && (showAnswer || showFollowUpAnswer)) ? "wipe-enter" : ""}`}
          />
        </div>
      </div>
      {/* Explanation for non-follow-up questions */}
      {
        questionResult && showExplanation && <div className="md:col-span-2">
          <p className={`${currentVariantQuestion.answer === selectedAnswer ? "text-green-500" : "text-red-500"} text-xl font-bold mb-4`}>
            {currentVariantQuestion.answer === selectedAnswer ? "Correct!" : "Incorrect!"}
            {questionMode === "iron-man" && currentVariantQuestion.answer === selectedAnswer && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-green-600 mt-2">
                ({questionsCompleted.length + 1}/{currentQuestionSet.length} total)
              </span>
            )}
            {questionMode === "standard" && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-gray-400 mt-2">
                Question {questionsCompleted.length + 1} of {standardQuestionLength} ({userResponses.filter(r => r.selected === r.correct && (!r.followUp || r.followUp.followUpSelected === r.followUp.followUpCorrect)).length + (currentVariantQuestion.answer === selectedAnswer ? 1 : 0)} correct)
              </span>
            )}
          </p>
          <p className="whitespace-pre-wrap">{renderItalicsAndBold(currentVariantQuestion.explanation)}</p>
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
  currentVariantQuestion: DoYouKnowSWUVariant,
  currentQuestionSet: DoYouKnowSWUQuestion[],
  questionsCompleted: number[],
  lastEndlessQuizzes: number[],
  standardQuestionLength: number,
  userResponses: UserResponse[],
  followUpSubmitted: boolean,
  followUpAnswer: string,
  sfx: (type: SfxType) => void,
  setQuestionsCompleted: React.Dispatch<React.SetStateAction<number[]>>,
  setCurrentQuestionId: React.Dispatch<React.SetStateAction<number>>,
  setLastEndlessQuizzes: React.Dispatch<React.SetStateAction<number[]>>,
  setUserResponses: React.Dispatch<React.SetStateAction<UserResponse[]>>,
  resetCurrentQuestionState: () => void,
  setFollowUpSubmitted: React.Dispatch<React.SetStateAction<boolean>>,
  setFollowUpAnswer: React.Dispatch<React.SetStateAction<string>>,
  setCurrentVariant: React.Dispatch<React.SetStateAction<number>>,
  setQuestionsEnded: React.Dispatch<React.SetStateAction<boolean>>
) {
  const endlessThreshold = 10; // Number of recent DYKSWU questions to track in endless mode

  if (questionMode === "iron-man") {
    const updatedCompleted = [...questionsCompleted];
    const isCorrectAnswer = selectedAnswer === currentVariantQuestion.answer &&
      (!currentVariantQuestion.followUp ||
       (currentVariantQuestion.followUp && followUpSubmitted && followUpAnswer === currentVariantQuestion.followUp.answer));

    if (isCorrectAnswer) {
      updatedCompleted.push(currentQuestionId);
      setQuestionsCompleted(updatedCompleted);
      const updatedResponses = [...userResponses];
      const newResponse: UserResponse = { modeId: currentQuestionId, selected: selectedAnswer, correct: currentVariantQuestion.answer };
      if (currentVariantQuestion.followUp) {
        newResponse.followUp = {
          followUpSelected: followUpAnswer,
          followUpCorrect: currentVariantQuestion.followUp.answer
        };
      }
      updatedResponses.push(newResponse);
      setUserResponses(updatedResponses);

      if (updatedCompleted.length !== currentQuestionSet.length) {
        const availableQuestions = currentQuestionSet.filter(q => !updatedCompleted.includes(q.id));
        if (availableQuestions.length > 0) {
          const nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
          setCurrentQuestionId(nextQuestion.id);
          setCurrentVariant(Math.floor(Math.random() * nextQuestion.variants.length));
          resetCurrentQuestionState();
        }
      }
    } else {
      setQuestionsEnded(true);
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
      setCurrentVariant(Math.floor(Math.random() * nextQuestion.variants.length));
      resetCurrentQuestionState();
    }
  } else {
    const updatedCompleted = [...questionsCompleted];
    updatedCompleted.push(currentQuestionId);
    setQuestionsCompleted(updatedCompleted);
    const updatedResponses = [...userResponses];
    const newResponse: UserResponse = { modeId: currentQuestionId, selected: selectedAnswer, correct: currentVariantQuestion.answer };
    if (currentVariantQuestion.followUp) {
      newResponse.followUp = {
        followUpSelected: followUpAnswer,
        followUpCorrect: currentVariantQuestion.followUp.answer
      };
    }
    updatedResponses.push(newResponse);
    setUserResponses(updatedResponses);
    if (questionMode === "standard" && updatedCompleted.length < standardQuestionLength) {
      setCurrentQuestionId(currentQuestionSet[updatedCompleted.length].id);
      setCurrentVariant(Math.floor(Math.random() * currentQuestionSet[updatedCompleted.length].variants.length));
      resetCurrentQuestionState();
    } else if (updatedCompleted.length !== currentQuestionSet.length) {
      const availableQuestions = currentQuestionSet.filter(q => !updatedCompleted.includes(q.id));
      if (availableQuestions.length > 0) {
        const nextQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        setCurrentQuestionId(nextQuestion.id);
        setCurrentVariant(Math.floor(Math.random() * nextQuestion.variants.length));
        resetCurrentQuestionState();
      }
    }
  }

  setFollowUpSubmitted(false);
  setFollowUpAnswer("");
  sfx("transition");
}

