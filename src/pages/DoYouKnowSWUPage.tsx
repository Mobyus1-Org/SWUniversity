import React from "react";
import { getDoYouKnowSWUDataAsync, getModeTitle, type AppModeSetEntry, type DoYouKnowSWUQuestion, type UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuestionContent } from "../components/DoYouKnowSWU/QuestionContent";

function DoYouKnowSWUPage() {
  const [allQuestions, setAllQuestions] = React.useState<DoYouKnowSWUQuestion[]>([]);
  const [currentQuestionSet, setCurrentQuestionSet] = React.useState<DoYouKnowSWUQuestion[]>(allQuestions);
  const [dykswuMode, setDykswuMode] = React.useState<"" | "standard" | "marathon" | "endless" | "padawan" | "knight" | "master">("");
  const [currentQuestionId, setCurrentQuestionId] = React.useState<number>(0);
  const [standardQuestionLength, setStandardQuestionLength] = React.useState<number>(0);
  const [questionResult, setQuestionResult] = React.useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string>("");
  const [questionsCompleted, setQuestionsCompleted] = React.useState<number[]>([]);
  const [userResponses, setUserResponses] = React.useState<UserResponse[]>([]);
  const [lastEndlessQuestions, setLastEndlessQuestions] = React.useState<number[]>([]);

  React.useEffect(() => {
    getDoYouKnowSWUDataAsync().then(data => {
      setAllQuestions(data);
    });
  }, []);

  const renderQuestionContent = () => currentQuestionSet.length === 0
      ? <p className="text-lg uwd:text-3xl 4k:text-5xl">Loading questions...</p>
      : <QuestionContent
        currentQuestionSet={currentQuestionSet}
        currentQuestionId={currentQuestionId}
        questionMode={dykswuMode}
        questionsCompleted={questionsCompleted}
        lastEndlessQuestions={lastEndlessQuestions}
        questionResult={questionResult}
        selectedAnswer={selectedAnswer}
        standardQuestionLength={standardQuestionLength}
        userResponses={userResponses}
        setCurrentQuestionId={setCurrentQuestionId}
        setQuestionResult={setQuestionResult}
        setSelectedAnswer={setSelectedAnswer}
        setQuestionsCompleted={setQuestionsCompleted}
        setLastEndlessQuestions={setLastEndlessQuestions}
        setQuestionMode={setDykswuMode}
        setStandardQuestionLength={setStandardQuestionLength}
        setUserResponses={setUserResponses}
        resetCurrentQuestionState={resetCurrentQuestionState}
        resetDoYouKnowSWUMode={resetDoYouKnowSWUMode}
      />;

    const resetCurrentQuestionState = () => {
      setSelectedAnswer("");
      setQuestionResult(false);
    }

    const resetDoYouKnowSWUMode = () => {
      resetCurrentQuestionState();
      setQuestionsCompleted([]);
      setDykswuMode("");
      setUserResponses([]);
      setStandardQuestionLength(0);
      setCurrentQuestionId(0);
    }

    return <div>
      <h1 className="w-auto mx-auto text-center text-4xl font-bold md:text-4xl uwd:!text-5xl 4k:!text-7xl font-bold mb-4 uwd:ml-2 4k:ml-4">{getModeTitle("dykswu", dykswuMode)}</h1>
      {
        dykswuMode === "" || (dykswuMode === "standard" && standardQuestionLength === 0)
          ? <ModeButtons
            mode={dykswuMode}
            allModeSet={allQuestions}
            standardModeLength={standardQuestionLength}
            setMode={setDykswuMode}
            setCurrentModeSet={setCurrentQuestionSet as React.Dispatch<React.SetStateAction<AppModeSetEntry[]>>}
            setCurrentModeId={setCurrentQuestionId}
            setStandardModeLength={setStandardQuestionLength}
          />
          : renderQuestionContent()
      }
    </div>;
  }

export default DoYouKnowSWUPage;
