import React from "react";
import { globalBackgroundStyle, type QuizModes } from "../../util/const";
import type { Quiz, UserResponse } from "../../util/func";
import { StandardModeEndScreen } from "./StandardModeEndScreen";
import { MarathonModeEndScreen } from "./MarathonModeEndScreen";

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
  setQuizMode,
  setStandardQuizLength,
  setUserResponses
}: IProps) {
  const [showModal, setShowModal] = React.useState(false);
  const currentQuiz = currentQuizSet.find(quiz => quiz.id === currentQuizId);
  const renderChoices = () => {
    if(currentQuizSet.length === 0) return null;
    if(!currentQuizKeys || currentQuizKeys.length === 0) {
      const choiceKeys = Object.keys(currentQuiz!.choices);
      for (let i = choiceKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choiceKeys[i], choiceKeys[j]] = [choiceKeys[j], choiceKeys[i]];
      }
      setCurrentQuizKeys(choiceKeys);
    }

    const highlighted = (index: number) => {
      if(!quizResult) return "";
      return currentQuiz!.answer === currentQuizKeys[index]
        ? "bg-green-800/50 px-4 py-1 rounded"
        : selectedAnswer === currentQuizKeys[index]
          ? "bg-red-800/50 px-4 py-1 rounded"
          : "";
    }

    const divs = currentQuizKeys.map((_, index) => <div key={index} className={"mb-2.5 " + highlighted(index)}>
        <label className="text-md md:text-lg">
          <input
            type="radio"
            name="quiz-choice"
            value={currentQuizKeys[index]}
            className="mr-2.5 md:scale-110"
            checked={selectedAnswer === currentQuizKeys[index]}
            onChange={() => setSelectedAnswer(currentQuizKeys[index])}
            disabled={quizResult}
          />
          {currentQuiz!.choices[currentQuizKeys[index]]}
        </label>
      </div>
    );

    return divs;
  }

  return <div>
  {
    (quizMode == "marathon" || quizMode == "newplayer") && quizzesCompleted.length === currentQuizSet.length && <MarathonModeEndScreen
      setQuizzesCompleted={setQuizzesCompleted}
      setCurrentQuizId={setCurrentQuizId}
      setQuizResult={setQuizResult}
      setSelectedAnswer={setSelectedAnswer}
      setQuizMode={setQuizMode}
      currentQuizSet={currentQuizSet}
    />
  }
  {
    quizMode == "standard" && quizzesCompleted.length === standardQuizLength && <StandardModeEndScreen
      userResponses={userResponses}
      setUserResponses={setUserResponses}
      currentQuizSet={currentQuizSet}
      standardQuizLength={standardQuizLength}
      setQuizMode={setQuizMode}
      setCurrentQuizId={setCurrentQuizId}
      setStandardQuizLength={setStandardQuizLength}
      setQuizzesCompleted={setQuizzesCompleted}
      setQuizResult={setQuizResult}
      setSelectedAnswer={setSelectedAnswer}
    />
  }
  {
      quizzesCompleted.length < currentQuizSet.length && currentQuiz && <div className={`grid ${globalBackgroundStyle} shadow-md md:grid-cols-[40%_60%] border p-8 rounded shadow-md gap-4`}>
      {/* Question and choices */}
      <div>
        <p className="mb-2.5 text-lg md:text-xl">{currentQuiz!.question}</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const quizChoice = form.elements.namedItem('quiz-choice') as HTMLInputElement;
          onSubmitAnswer(quizChoice.value, setQuizResult);
        }}>
        {renderChoices()}
        {!quizResult && <button type="submit" className="btn btn-primary mt-4 text-lg p-4">Submit Answer</button>}
        {
          quizResult && quizzesCompleted.length < currentQuizSet.length
            ? <button className="btn btn-secondary mt-4 text-lg p-4" onClick={() =>
                  onNextQuestion(quizMode, selectedAnswer, currentQuizId, currentQuiz!.answer.toString(),
                    currentQuizSet, quizzesCompleted, lastEndlessQuizzes, standardQuizLength, userResponses,
                    setQuizzesCompleted, setCurrentQuizId, setQuizResult, setSelectedAnswer, setLastEndlessQuizzes, setUserResponses)}>
                Next Question
              </button>
            : null
        }
        </form>
      </div>
      {/* Images */}
      <div className="flex-1 flex flex-[0_0_50%] flex-wrap items-center justify-center">
      {
        currentQuiz!.relevantCards && currentQuiz!.relevantCards.length > 0
        ? <div>
          <div className="text-xl mb-2.5 mr-2">Relevant Cards</div>
          <div className="text-sm"><u onClick={() => setShowModal(true)}>(Click here to see enlarged images)</u></div>
          <div className="flex flex-wrap justify-center">
            {
              currentQuiz!.relevantCards.map((cardName: string, index: number) => <div key={index} className="w-fit h-72 m-2.5">
                <img src={`https://swudb.com/cdn-cgi/image/quality=40/images/cards/${cardName}.png`} alt={`card ${cardName}`} className="max-h-full object-contain" />
              </div>)
            }
          </div>
        </div>
        : <div className="w-fit h-72 m-2.5">
          <img src="/assets/Mobyus1_Cardback.png" alt="card back" className="max-h-full object-contain" />
        </div>
      }
      </div>
      {/* Relevant rule */}
      {
        quizResult && currentQuiz!.relevantRule != " " && <div className="md:col-span-2 mt-4">
          <p className="text-xl mb-2.5">Relevant Rules:</p>
          <p className="whitespace-pre-wrap">{currentQuiz!.relevantRule}</p>
        </div>
      }
      {/*Relevant Cards Modal*/}
      {
        currentQuiz!.relevantCards &&
        currentQuiz!.relevantCards.length > 0 &&
        showModal && <div className="overflow-y-scroll fixed inset-0 bg-black bg-opacity-70 flex flex-wrap" onClick={() => setShowModal(false)}>
          <p className="absolute top-2 md:top-4 right-4 md:right-8 text-gray-400 md:text-4xl" onClick={() => setShowModal(false)}>X</p>
          <div className="flex flex-wrap justify-center py-8 md:px-24">
          {
            currentQuiz!.relevantCards.map((cardName: string, index: number) => <div key={index} className="w-fit h-100 md:h-120 m-2.5">
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

function onSubmitAnswer(selectedIndex: string, setQuizResult: (result: boolean) => void) {
  if (selectedIndex) {
    setQuizResult(true);
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
  setQuizzesCompleted: (completed: number[]) => void,
  setCurrentQuizId: (id: number) => void,
  setQuizResult: (result: boolean) => void,
  setSelectedAnswer: (answer: string) => void,
  setLastEndlessQuizzes: (list: number[]) => void,
  setUserResponses: (responses: UserResponse[]) => void
)
{
  const endlessThreshold = 25; // Number of recent quizzes to track in endless mode

  if(quizMode === "marathon" || quizMode === "newplayer") {
    const updatedCompleted = [...quizzesCompleted];
    if(selectedAnswer === currentQuizAnswer) {
      updatedCompleted.push(currentQuizId);
      setQuizzesCompleted(updatedCompleted);
    }
    if(updatedCompleted.length !== currentQuizSet.length) {
      let nextQuiz = currentQuizSet[Math.floor(Math.random() * currentQuizSet.length)].id;
      while(updatedCompleted.includes(nextQuiz)) {
        nextQuiz = currentQuizSet[Math.floor(Math.random() * currentQuizSet.length)].id;
      }
      setCurrentQuizId(nextQuiz);
      setQuizResult(false);
      setSelectedAnswer("");
    }
  } else if(quizMode === "endless") {
    const updatedLastEndless = [...lastEndlessQuizzes, currentQuizId];
    if(updatedLastEndless.length > endlessThreshold) {
      updatedLastEndless.shift();
    }
    setLastEndlessQuizzes(updatedLastEndless);
    let nextQuiz = currentQuizSet[Math.floor(Math.random() * currentQuizSet.length)].id;
    while(updatedLastEndless.includes(nextQuiz)) {
        nextQuiz = currentQuizSet[Math.floor(Math.random() * currentQuizSet.length)].id;
    }
    setCurrentQuizId(nextQuiz);
    setQuizResult(false);
    setSelectedAnswer("");
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
      setQuizResult(false);
      setSelectedAnswer("");
    }
  }
}