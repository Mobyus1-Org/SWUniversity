import React from "react";
import { getModeTitle, getQuizDataAsync, preloadImagesAsync } from "../util/func";
import type { AppModeSetEntry, Quiz, UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuizContent } from "../components/Quiz/QuizContent";
import { globalBackgroundStyle, type AppModes, type ModeDescriptions } from "../util/const";
import { useSearchParams } from "react-router-dom";

function QuizPage() {
  const [loading, setLoading] = React.useState(true);
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
  //TODO: remove this once we go live
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("Mobyus1hereisatestid");

  React.useEffect(() => {
    getQuizDataAsync().then(data => {
      setAllQuizzes(testId ? data.filter(q => q.id === Number(testId)) : data);
      if(sessionStorage.getItem("loadedQuizData") === "true") {
        setLoading(false);
        return;
      }

      preloadImagesAsync(data.flatMap((quiz) => quiz.relevantCards)).then(() => {
        setLoading(false);
        sessionStorage.setItem("loadedQuizData", "true");
      });
    });
  }, [testId]);

  const renderQuizContent = () => loading
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
  };

  const resetQuizMode = () => {
    resetCurrentQuizState();
    setQuizzesCompleted([]);
    setQuizMode("");
    setUserResponses([]);
    setStandardQuizLength(0);
    setCurrentQuizId(0);
    setLastEndlessQuizzes([]);
  };

  const quizModeSets = {
    all: allQuizzes,
    padawan: allQuizzes.filter(quiz => quiz.difficulty === 0),
    knight: allQuizzes.filter(quiz => quiz.difficulty === 1),
    master: allQuizzes.filter(quiz => quiz.difficulty === 2),
  }

  const modeDescriptions: ModeDescriptions = {
    "": "",
    "standard": "Choose a set number of questions to be pulled from our databank and see how many you can answer correctly!",
    "marathon": `Correctly answer every question in the databank once to complete the marathon!\n\nTotal Questions: ${quizModeSets.all.length}`,
    "endless": "Answer random questions with no end in sight!",
    "padawan": `A perfect place for new players to test their knowledge of the basics of SWU!\n\nTotal Questions: ${quizModeSets.padawan.length}`,
    "knight": `A challenging mode for those who have a solid understanding of SWU and want to test their skills further!\n\nTotal Questions: ${quizModeSets.knight.length}`,
    "master": `The ultimate test for SWU experts! Only the most knowledgeable players will be able to conquer this mode!\n\nTotal Questions: ${quizModeSets.master.length}`
  }

  return <div>
    <h1 className="text-center text-4xl font-bold md:text-4xl uwd:!text-5xl 4k:!text-7xl mb-4">{getModeTitle("quiz", quizMode)}</h1>
    {
      quizMode === "" && <div className={`${globalBackgroundStyle} lg:w-3/4 xl:w-1/2 m-auto text-xl uwd:text-3xl 4k:text-5xl text-center p-2 mb-4 4k:p-4 4k:mb-8 border`}>
        <p>
          Welcome to the SWUniversity Quiz Game!
          <br/>Test your knowledge of the SWU TCG with a variety of quiz modes:
        </p>
        <div className="w-3/4 uwd:w-1/2 4k:w-5/8 m-auto">
          <p className="text-sm uwd:text-lg uwd:my-2 4k:text-3xl 4k:my-4 text-left">
            Standard Mode: Choose a set number of questions to answer.
            <br/>Marathon Mode: Answer all questions in the databank correctly to complete the marathon.
            <br/>Endless Mode: Answer random questions with no end in sight.
            <br/>Difficulty Modes: Choose from Padawan (easy), Knight (medium), or Master (hard) question sets.
            <br/>Select a mode to get started and see how well you know the SWU TCG!
          </p>
        </div>
      </div>
    }
    {
      quizMode === "" || (quizMode === "standard" && standardQuizLength === 0)
        ? <ModeButtons
          mode={quizMode}
          appModeSets={quizModeSets}
          standardModeLength={standardQuizLength}
          modeDescriptions={modeDescriptions}
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
