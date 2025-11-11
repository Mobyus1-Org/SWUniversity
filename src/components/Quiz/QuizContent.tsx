import React from "react";
import { globalBackgroundStyle, globalBackgroundStyleBigShadow, getLightsaberGlowHover } from "../../util/style-const";
import { type AppModes, type SfxType } from "../../util/const";
import { renderItalicsAndBold, type Quiz, type UserResponse, getSWUDBImageLink } from "../../util/func";
import { ModeEndScreen } from "../Shared/ModeEndScreen";
import { AudioContext, ModalContext, UserSettingsContext, type ModalContextProps } from "../../util/context";
import { RelevantCardsPanel } from "./RelevantCardsPanel";

interface IProps {
  currentQuizSet: Quiz[];
  currentQuizId: number;
  quizMode: AppModes;
  quizzesCompleted: number[];
  lastEndlessQuizzes: number[];
  quizResult: boolean;
  selectedAnswer: string;
  currentQuizKeys: string[];
  standardQuizLength: number;
  userResponses: UserResponse[];
  quizEnded: boolean;
  setCurrentQuizId: React.Dispatch<React.SetStateAction<number>>;
  setQuizResult: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAnswer: React.Dispatch<React.SetStateAction<string>>;
  setQuizzesCompleted: React.Dispatch<React.SetStateAction<number[]>>;
  setLastEndlessQuizzes: React.Dispatch<React.SetStateAction<number[]>>;
  setCurrentQuizKeys: React.Dispatch<React.SetStateAction<string[]>>;
  setQuizMode: React.Dispatch<React.SetStateAction<AppModes>>;
  setStandardQuizLength: React.Dispatch<React.SetStateAction<number>>;
  setUserResponses: React.Dispatch<React.SetStateAction<UserResponse[]>>;
  resetCurrentQuizState: () => void;
  resetQuizMode: () => void;
  setQuizEnded: React.Dispatch<React.SetStateAction<boolean>>;
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
  quizEnded,
  setCurrentQuizId,
  setQuizResult,
  setSelectedAnswer,
  setQuizzesCompleted,
  setCurrentQuizKeys,
  setLastEndlessQuizzes,
  setUserResponses,
  resetCurrentQuizState,
  resetQuizMode,
  setQuizEnded
}: IProps) {
  const defaultModalContext: ModalContextProps = { showModal: false,
    setShowModal: () => {},
    modalKey: "",
    setModalKey: () => {},
    modalData: {},
    setModalData: () => {}
  };
  const { showModal, setShowModal, modalKey, setModalKey, setModalData } = React.useContext(ModalContext) ?? defaultModalContext;
  const userSettings = React.useContext(UserSettingsContext);
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
      setModalData({ currentQuiz });
    }
  }, [currentQuiz, currentQuizKeys.length, setCurrentQuizKeys, setModalData]);

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

    const divs = currentQuizKeys.map((_, index) => <div key={"choice-" + index} className={`mb-2.5 uwd:mb-4 4k:mb-8 ${highlighted(index)}`}>
        <button
          type="button"
          className={`w-full text-left px-4 uwd:px-8 4k:px-16 py-2 uwd:py-4 4k:py-8 border rounded-lg hover:bg-slate-700/50 ${currentHover}
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
          <div className="text-md md:text-lg uwd:!text-3xl 4k:!text-5xl">
            {renderItalicsAndBold(currentQuiz.choices[currentQuizKeys[index]])}
          </div>
        </button>
      </div>
    );

    return divs;
  }

  const currentHover = getLightsaberGlowHover(userSettings?.lightsaberColor || 'blue');

  return <div className={`p-2 border rounded ${globalBackgroundStyleBigShadow}`}>
  {
    (quizMode !== "" && quizzesCompleted.length === currentQuizSet.length
      || quizMode === "iron-man" && quizEnded)
      && <ModeEndScreen
        app="quiz"
        appMode={quizMode}
        userResponses={userResponses}
        currentModeSet={currentQuizSet}
        standardModeLength={standardQuizLength}
        ironManFailed={quizEnded}
        resetQuizMode={resetQuizMode}
      />
  }
  {
      !quizEnded && quizzesCompleted.length < currentQuizSet.length && <div className={`grid ${globalBackgroundStyle} shadow-md md:grid-cols-[40%_60%] border p-8 rounded gap-4`}>
      {/* Question and choices */}
      <div>
        <p className="mb-2.5 uwd:mb-8 text-lg md:text-xl uwd:!text-3xl 4k:!text-5xl 4k:p-8">{renderItalicsAndBold(currentQuiz.question)}</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (selectedAnswer !== "") {
            onSubmitAnswer(selectedAnswer, setQuizResult, sfx);
          }
        }}>
        {renderChoices()}
        {!quizResult && <button type="submit" className={`btn btn-primary mt-4 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}`}>Submit Answer</button>}
        {
          quizResult && quizzesCompleted.length < currentQuizSet.length
            ? <button className={`btn btn-secondary mt-4 text-lg p-4 uwd:text-2xl uwd:p-8 4k:text-4xl 4k:p-12 ${currentHover}`} onClick={() =>
                  onNextQuestion(quizMode, selectedAnswer, currentQuizId, currentQuiz.answer.toString(),
                    currentQuizSet, quizzesCompleted, lastEndlessQuizzes, standardQuizLength, userResponses,
                    sfx,
                    setQuizzesCompleted, setCurrentQuizId, setLastEndlessQuizzes,
                    setUserResponses, resetCurrentQuizState, setQuizEnded)}>
                Next Question
              </button>
            : null
        }
        </form>
      </div>
      {/* Images */}
      <RelevantCardsPanel currentQuiz={currentQuiz} setShowModal={setShowModal} setModalKey={setModalKey} />
      {/* Relevant rule */}
      {
        quizResult && currentQuiz.relevantRule !== " " && <div className="md:col-span-2 text-xl uwd:text-3xl 4k:text-5xl">
          <p className={`${currentQuiz.answer === selectedAnswer ? "text-green-500" : "text-red-500"} font-bold mb-4`}>
            {currentQuiz.answer === selectedAnswer ? "Correct!" : "Incorrect!"}
            {quizMode === "iron-man" && currentQuiz.answer === selectedAnswer && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-green-600 mt-2">
                ({quizzesCompleted.length + 1}/{currentQuizSet.length} total)
              </span>
            )}
            {quizMode === "standard" && (
              <span className="block text-sm md:text-base uwd:!text-xl 4k:!text-2xl text-gray-400 mt-2">
                Question {quizzesCompleted.length + 1} of {standardQuizLength} ({userResponses.filter(r => r.selected === r.correct).length + (currentQuiz.answer === selectedAnswer ? 1 : 0)} correct)
              </span>
            )}
          </p>
          <p className="mb-2.5 font-bold">Relevant Rules:</p>
          <p className="whitespace-pre-wrap">{renderItalicsAndBold(currentQuiz.relevantRule)}</p>
        </div>
      }
      {/*Relevant Cards Modal*/}
      {
        currentQuiz.relevantCards.length > 0 &&
          showModal && modalKey === "relevant-cards" && <div role="dialog" aria-modal="true" className="z-50 fixed inset-0 -top-20 h-screen bg-black flex flex-wrap" onClick={() => setShowModal(false)}>
          <p className="absolute top-2 md:top-4 right-4 md:right-8 text-gray-400 md:text-4xl 4k:!text-7xl" onClick={() => setShowModal(false)}>X</p>
          <div className="flex flex-wrap justify-center py-8 md:px-24">
          {
            currentQuiz.relevantCards.map((cardName: string, index: number) => <div key={"relevant-card-" + index}
                className="w-fit h-100 lg:h-120 uwd:!h-190 4k:!h-280 m-2.5">
              <img src={getSWUDBImageLink(cardName)} alt={`card ${cardName}`} className="max-h-full object-contain" />
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
  quizMode: AppModes,
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
  resetCurrentQuizState: () => void,
  setQuizEnded: (ended: boolean) => void
)
{
  const endlessThreshold = 35; // Number of recent quizzes to track in endless mode

  if(quizMode === "iron-man") {
    const updatedCompleted = [...quizzesCompleted];
    if(selectedAnswer === currentQuizAnswer) {
      updatedCompleted.push(currentQuizId);
      setQuizzesCompleted(updatedCompleted);
      const updatedResponses = [...userResponses];
      updatedResponses.push({modeId: currentQuizId, selected: selectedAnswer, correct: currentQuizAnswer});
      setUserResponses(updatedResponses);
      if(updatedCompleted.length !== currentQuizSet.length) {
        const availableQuizzes = currentQuizSet.filter(q => !updatedCompleted.includes(q.id));
        if (availableQuizzes.length > 0) {
          const nextQuiz = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
          setCurrentQuizId(nextQuiz.id);
          resetCurrentQuizState();
        }
      }
    } else {
      setQuizEnded(true);
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
  } else {
    const updatedCompleted = [...quizzesCompleted];
    updatedCompleted.push(currentQuizId);
    setQuizzesCompleted(updatedCompleted);
    const updatedResponses = [...userResponses];
    updatedResponses.push({modeId: currentQuizId, selected: selectedAnswer, correct: currentQuizAnswer});
    setUserResponses(updatedResponses);
    if(quizMode === "standard" && updatedCompleted.length < standardQuizLength) {
      setCurrentQuizId(currentQuizSet[updatedCompleted.length].id);
      resetCurrentQuizState();
    } else if (updatedCompleted.length !== currentQuizSet.length) {
      const availableQuizzes = currentQuizSet.filter(q => !updatedCompleted.includes(q.id));
      if (availableQuizzes.length > 0) {
        const nextQuestion = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
        setCurrentQuizId(nextQuestion.id);
        resetCurrentQuizState();
      }
    }
  }

  sfx("transition");
}

