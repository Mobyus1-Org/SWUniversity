import React from "react";
import { globalBackgroundStyle, isMarathonVariant, type QuizModes, type SfxType } from "../../util/const";
import type { Quiz, UserResponse } from "../../util/func";
import { StandardModeEndScreen } from "./StandardModeEndScreen";
import { MarathonModeEndScreen } from "./MarathonModeEndScreen";
import { AudioContext } from "../../util/context";

interface IProps {
  currentQuizSet: Quiz[];
  currentQuizId: number;
  quizMode: QuizModes;
  quizzesCompleted: number[];
  lastEndlessQuizzes: number[];
  quizResult: boolean;
  selectedAnswer: string;
  currentQuizKeys: string[];
  standardQuizLength: number;
  userResponses: UserResponse[];
  setCurrentQuizId: (id: number) => void;
  setQuizResult: (result: boolean) => void;
  setSelectedAnswer: (answer: string) => void;
  setQuizzesCompleted: (completed: number[]) => void;
  setLastEndlessQuizzes: (list: number[]) => void;
  setCurrentQuizKeys: (keys: string[]) => void;
  setQuizMode: (mode: QuizModes) => void;
  setStandardQuizLength: (length: number) => void;
  setUserResponses: (responses: UserResponse[]) => void;
  resetCurrentQuizState: () => void;
  resetQuizMode: () => void;
}

export function QuizContent({
  currentQuizSet,
  currentQuizId,
  quizMode,
  quizzesCompleted,
  lastEndlessQuizzes,
  quizResult,
  selectedAnswer,
  currentQuizKeys,
  standardQuizLength,
  userResponses,
  setCurrentQuizId,
  setQuizResult,
  setSelectedAnswer,
  setQuizzesCompleted,
  setCurrentQuizKeys,
  setLastEndlessQuizzes,
  setUserResponses,
  resetCurrentQuizState,
  resetQuizMode
}: IProps) {
  const [showModal, setShowModal] = React.useState(false);
  const currentQuiz = currentQuizSet.find(quiz => quiz.id === currentQuizId);

  React.useEffect(() => {
    setCurrentQuizKeys([]);
  }, [currentQuizId, setCurrentQuizKeys]);

  React.useEffect(() => {
    if(currentQuiz && currentQuizKeys.length === 0) {
      const choiceKeys = Object.keys(currentQuiz.choices);
      for (let i = choiceKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choiceKeys[i], choiceKeys[j]] = [choiceKeys[j], choiceKeys[i]];
      }
      setCurrentQuizKeys(choiceKeys);
    }
  }, [currentQuiz, currentQuizKeys.length, setCurrentQuizKeys]);

  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };

  if(!currentQuiz) return <p className="text-lg">Loading quiz...</p>;

  const renderChoices = () => {
    if(currentQuizSet.length === 0) return null;

    const highlighted = (index: number) => {
      if (!quizResult) return "";

      const key = currentQuizKeys[index];
      if (currentQuiz.answer === key) return "bg-green-800/50 rounded";
      if (selectedAnswer === key) return "bg-red-800/50 rounded";

      return "";
    };

    const divs = currentQuizKeys.map((_, index) => <div key={index} className={"mb-2.5 " + highlighted(index)}>
        <button
          type="button"
          className={`w-full text-left p-3 border rounded-lg hover:bg-slate-700/50 transition-colors
            ${
              selectedAnswer === currentQuizKeys[index]
                ? 'border-white bg-slate-600/50'
                : 'border-slate-600'
            }
            ${
              quizResult
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
            }
          `}
          onClick={() => {
            if (!quizResult) {
              sfx("click");
              setSelectedAnswer(currentQuizKeys[index]);
            }
          }}
          disabled={quizResult}
        >
          <div className="text-md md:text-lg">
            {currentQuiz.choices[currentQuizKeys[index]]}
          </div>
        </button>
      </div>
    );

    return divs;
  }

  return <div className={"border rounded p-2 " + globalBackgroundStyle}>
  {
    isMarathonVariant(quizMode)
      && quizzesCompleted.length === currentQuizSet.length
      && <MarathonModeEndScreen resetQuizMode={resetQuizMode} />
  }
  {
    quizMode === "standard"
      && quizzesCompleted.length === standardQuizLength
      && <StandardModeEndScreen
        userResponses={userResponses}
        currentQuizSet={currentQuizSet}
        standardQuizLength={standardQuizLength}
        resetQuizMode={resetQuizMode}
      />
  }
  {
      quizzesCompleted.length < currentQuizSet.length && <div className={`grid ${globalBackgroundStyle} shadow-md md:grid-cols-[40%_60%] border p-8 rounded gap-4`}>
      {/* Question and choices */}
      <div>
        <p className="mb-2.5 text-lg md:text-xl">{currentQuiz.question}</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (selectedAnswer !== "") {
            onSubmitAnswer(selectedAnswer, setQuizResult, sfx);
          }
        }}>
        {renderChoices()}
        {!quizResult && <button type="submit" className="btn btn-primary mt-4 text-lg p-4">Submit Answer</button>}
        {
          quizResult && quizzesCompleted.length < currentQuizSet.length
            ? <button className="btn btn-secondary mt-4 text-lg p-4" onClick={() =>
                  onNextQuestion(quizMode, selectedAnswer, currentQuizId, currentQuiz.answer.toString(),
                    currentQuizSet, quizzesCompleted, lastEndlessQuizzes, standardQuizLength, userResponses, sfx,
                    setQuizzesCompleted, setCurrentQuizId, setLastEndlessQuizzes, setUserResponses, resetCurrentQuizState)}>
                Next Question
              </button>
            : null
        }
        </form>
      </div>
      {/* Images */}
      <div className="flex-1 flex flex-[0_0_50%] flex-wrap items-center justify-center">
      {
        currentQuiz.relevantCards.length > 0
        ? <div>
          <div className="text-xl mb-2.5 mr-2">Relevant Cards</div>
          <div className="text-sm"><u onClick={() => setShowModal(true)}>(Click here to see enlarged images)</u></div>
          <div className="flex flex-wrap justify-center">
            {
              currentQuiz.relevantCards.map((cardName: string, index: number) => <div key={index} className="w-fit h-72 m-2.5">
                <img src={`https://swudb.com/cdn-cgi/image/quality=40/images/cards/${cardName}.png`} alt={`card ${cardName}`} className="max-h-full object-contain" />
              </div>)
            }
          </div>
        </div>
        : <div className="w-fit h-72 m-2.5">
          <img src="/assets/SWUniversity_Cardback.png" alt="card back" className="max-h-full object-contain" />
        </div>
      }
      </div>
      {/* Relevant rule */}
      {
        quizResult && currentQuiz.relevantRule != " " && <div className="md:col-span-2">
          <p className={`${currentQuiz.answer === selectedAnswer ? "text-green-500" : "text-red-500"} text-xl font-bold mb-4`}>
            {currentQuiz.answer === selectedAnswer ? "Correct!" : "Incorrect!"}
          </p>
          <p className="text-xl mb-2.5">Relevant Rules:</p>
          <p className="whitespace-pre-wrap">{currentQuiz.relevantRule}</p>
        </div>
      }
      {/*Relevant Cards Modal*/}
      {
        currentQuiz.relevantCards.length > 0 &&
        showModal && <div className="overflow-y-scroll fixed inset-0 bg-black bg-opacity-70 flex flex-wrap" onClick={() => setShowModal(false)}>
          <p className="absolute top-2 md:top-4 right-4 md:right-8 text-gray-400 md:text-4xl" onClick={() => setShowModal(false)}>X</p>
          <div className="flex flex-wrap justify-center py-8 md:px-24">
          {
            currentQuiz.relevantCards.map((cardName: string, index: number) => <div key={index} className="w-fit h-100 md:h-120 m-2.5">
              <img src={`https://swudb.com/cdn-cgi/image/quality=40/images/cards/${cardName}.png`} alt={`card ${cardName}`} className="max-h-full object-contain" />
            </div>)
          }
          </div>
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
  quizMode: QuizModes,
  selectedAnswer: string,
  currentQuizId: number,
  currentQuizAnswer: string,
  currentQuizSet: Quiz[],
  quizzesCompleted: number[],
  lastEndlessQuizzes: number[],
  standardQuizLength: number,
  userResponses: UserResponse[],
  sfx: (type: SfxType) => void,
  setQuizzesCompleted: (completed: number[]) => void,
  setCurrentQuizId: (id: number) => void,
  setLastEndlessQuizzes: (list: number[]) => void,
  setUserResponses: (responses: UserResponse[]) => void,
  resetCurrentQuizState: () => void
)
{
  const endlessThreshold = 25; // Number of recent quizzes to track in endless mode

  if(isMarathonVariant(quizMode)) {
    const updatedCompleted = [...quizzesCompleted];
    if(selectedAnswer === currentQuizAnswer) {
      updatedCompleted.push(currentQuizId);
      setQuizzesCompleted(updatedCompleted);
    }
    if(updatedCompleted.length !== currentQuizSet.length) {
      const availableQuizzes = currentQuizSet.filter(q => !updatedCompleted.includes(q.id));
      if (availableQuizzes.length > 0) {
        const nextQuiz = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
        setCurrentQuizId(nextQuiz.id);
        resetCurrentQuizState();
      }
    }
  } else if(quizMode === "endless") {
    const updatedLastEndless = [...lastEndlessQuizzes, currentQuizId];
    if(updatedLastEndless.length > endlessThreshold) {
      updatedLastEndless.shift();
    }
    setLastEndlessQuizzes(updatedLastEndless);
    const availableQuizzes = currentQuizSet.filter(q => !updatedLastEndless.includes(q.id));
    if (availableQuizzes.length > 0) {
      const nextQuiz = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
      setCurrentQuizId(nextQuiz.id);
      resetCurrentQuizState();
    }
  } else if(quizMode === "standard") {
    const updatedCompleted = [...quizzesCompleted];
    updatedCompleted.push(currentQuizId);
    setQuizzesCompleted(updatedCompleted);
    const updatedResponses = [...userResponses];
    updatedResponses.push({quizId: currentQuizId, selected: selectedAnswer, correct: currentQuizAnswer});
    setUserResponses(updatedResponses);
    if(updatedCompleted.length < standardQuizLength) {
      console.log(currentQuizSet);
      console.log(currentQuizId, updatedCompleted.length, currentQuizSet[updatedCompleted.length]);
      setCurrentQuizId(currentQuizSet[updatedCompleted.length].id);
      resetCurrentQuizState();
    }
  }

  sfx("click");
}

