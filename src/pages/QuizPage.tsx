import React from "react";
import { getModeTitle, getQuizDataAsync } from "../util/func";
import type { AppModeSetEntry, Quiz, UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuizContent } from "../components/Quiz/QuizContent";
import type { AppModes } from "../util/const";

function QuizPage() {
  const [allQuizzes, setAllQuizzes] = React.useState<Quiz[]>([]);
  const [currentQuizSet, setCurrentQuizSet] = React.useState<Quiz[]>(allQuizzes);
  const [quizMode, setQuizMode] = React.useState<AppModes>("");
  const [currentQuizId, setCurrentQuizId] = React.useState<number>(0);
  const [currentQuizKeys, setCurrentQuizKeys] = React.useState<string[]>([]);
  const [quizzesCompleted, setQuizzesCompleted] = React.useState<number[]>([]);
  const [lastEndlessQuizzes, setLastEndlessQuizzes] = React.useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string>("");
  const [quizResult, setQuizResult] = React.useState<boolean>(false);
  const [standardQuizLength, setStandardQuizLength] = React.useState<number>(0);
  const [userResponses, setUserResponses] = React.useState<UserResponse[]>([]);

  React.useEffect(() => {
    getQuizDataAsync().then(data => {
      setAllQuizzes(data);
    });
  }, []);

  const renderQuizContent = () => currentQuizSet.length === 0
    ? <p className="text-lg uwd:text-3xl 4k:text-5xl">Loading quizzes...</p>
    : <QuizContent
      currentQuizSet={currentQuizSet}
      currentQuizId={currentQuizId}
      quizMode={quizMode}
      quizzesCompleted={quizzesCompleted}
      lastEndlessQuizzes={lastEndlessQuizzes}
      quizResult={quizResult}
      selectedAnswer={selectedAnswer}
      currentQuizKeys={currentQuizKeys}
      standardQuizLength={standardQuizLength}
      userResponses={userResponses}
      setCurrentQuizId={setCurrentQuizId}
      setQuizResult={setQuizResult}
      setSelectedAnswer={setSelectedAnswer}
      setQuizzesCompleted={setQuizzesCompleted}
      setCurrentQuizKeys={setCurrentQuizKeys}
      setLastEndlessQuizzes={setLastEndlessQuizzes}
      setQuizMode={setQuizMode}
      setStandardQuizLength={setStandardQuizLength}
      setUserResponses={setUserResponses}
      resetCurrentQuizState={resetCurrentQuizState}
      resetQuizMode={resetQuizMode}
    />;

  const resetCurrentQuizState = () => {
    setSelectedAnswer("");
    setQuizResult(false);
    setCurrentQuizKeys([]);
  }

  const resetQuizMode = () => {
    resetCurrentQuizState();
    setQuizzesCompleted([]);
    setQuizMode("");
    setUserResponses([]);
    setStandardQuizLength(0);
    setCurrentQuizId(0);
  }

  return <div>
    <h1 className="text-2xl md:text-4xl uwd:!text-5xl 4k:!text-7xl font-bold mb-4 uwd:ml-2 4k:ml-4">{getModeTitle("quiz", quizMode)}</h1>
    {
      quizMode === "" || (quizMode === "standard" && standardQuizLength === 0)
        ? <ModeButtons
          mode={quizMode}
          allModeSet={allQuizzes}
          standardModeLength={standardQuizLength}
          setMode={setQuizMode}
          setCurrentModeSet={setCurrentQuizSet as React.Dispatch<React.SetStateAction<AppModeSetEntry[]>>}
          setCurrentModeId={setCurrentQuizId}
          setStandardModeLength={setStandardQuizLength}
        />
        : renderQuizContent()
    }
  </div>;
}

export default QuizPage;
