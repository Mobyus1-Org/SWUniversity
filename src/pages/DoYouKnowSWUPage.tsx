import React from "react";
import { getDoYouKnowSWUDataAsync, getModeTitle, preloadImagesAsync, type AppModeSetEntry, type DoYouKnowSWUQuestion, type UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuestionContent } from "../components/DoYouKnowSWU/QuestionContent";
import { globalBackgroundStyle, type AppModes, type ModeDescriptions } from "../util/const";
import { useSearchParams } from "react-router-dom";

function DoYouKnowSWUPage() {
  const [loading, setLoading] = React.useState(true);
  const [allQuestions, setAllQuestions] = React.useState<DoYouKnowSWUQuestion[]>([]);
  const [currentQuestionSet, setCurrentQuestionSet] = React.useState<DoYouKnowSWUQuestion[]>(allQuestions);
  const [dykswuMode, setDykswuMode] = React.useState<AppModes>("");
  const [currentQuestionId, setCurrentQuestionId] = React.useState<number>(0);
  const [currentVariant, setCurrentVariant] = React.useState<number>(0);
  const [currentFollowUpKeys, setCurrentFollowUpKeys] = React.useState<string[]>([]);
  const [standardQuestionLength, setStandardQuestionLength] = React.useState<number>(0);
  const [questionResult, setQuestionResult] = React.useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string>("");
  const [questionsCompleted, setQuestionsCompleted] = React.useState<number[]>([]);
  const [userResponses, setUserResponses] = React.useState<UserResponse[]>([]);
  const [lastEndlessQuestions, setLastEndlessQuestions] = React.useState<number[]>([]);
  //TODO: remove this once we go live
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("Mobyus1hereisatestid");

  React.useEffect(() => {
    getDoYouKnowSWUDataAsync().then(data => {
      setAllQuestions(testId ? data.filter(q => q.id === Number(testId)) : data);
      if(sessionStorage.getItem("loadedDYKSWUData") === "true") {
        setLoading(false);
        return;
      }

      preloadImagesAsync(data.map((question) => question.actualCard)).then(() => {
        setLoading(false);
        sessionStorage.setItem("loadedDYKSWUData", "true");
      });
    });
  }, [testId]);

  const renderQuestionContent = () => loading
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
      currentFollowUpKeys={currentFollowUpKeys}
      currentVariant={currentVariant}
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
      setCurrentFollowUpKeys={setCurrentFollowUpKeys}
      setCurrentVariant={setCurrentVariant}
    />;

  const resetCurrentQuestionState = () => {
    setSelectedAnswer("");
    setQuestionResult(false);
    setCurrentFollowUpKeys([]);
  };

  const resetDoYouKnowSWUMode = () => {
    resetCurrentQuestionState();
    setQuestionsCompleted([]);
    setDykswuMode("");
    setUserResponses([]);
    setStandardQuestionLength(0);
    setCurrentQuestionId(0);
    setCurrentVariant(0);
    setLastEndlessQuestions([]);
  };

  const dykswuSets = {
    all: allQuestions,
    padawan: allQuestions.filter(q => q.variants.some(v => v.difficulty === 0)).map(q => ({
      ...q,
      variants: q.variants.filter(v => v.difficulty === 0)
    })),
    knight: allQuestions.filter(q => q.variants.some(v => v.difficulty === 1)).map(q => ({
      ...q,
      variants: q.variants.filter(v => v.difficulty === 1)
    })),
    master: allQuestions.filter(q => q.variants.some(v => v.difficulty === 2)).map(q => ({
      ...q,
      variants: q.variants.filter(v => v.difficulty === 2)
    })),
  }

  const modeDescriptions: ModeDescriptions = {
    "": "",
    "marathon": `All Cards\n\nTotal Questions: ${dykswuSets.all.length}`,
    "endless": "Endless Cards",
    "standard": "Choose cards mixed",
    "padawan": `Easy Cards\n\nTotal Questions: ${dykswuSets.padawan.length}`,
    "knight": `Medium Cards\n\nTotal Questions: ${dykswuSets.knight.length}`,
    "master": `Hard Cards\n\nTotal Questions: ${dykswuSets.master.length}`,
  };

  return <div>
    <h1 className="text-center text-4xl font-bold md:text-4xl uwd:!text-5xl 4k:!text-7xl mb-4">{getModeTitle("dykswu", dykswuMode)}</h1>
    <div className={`${globalBackgroundStyle} w-1/2 m-auto text-xl text-center p-2 mb-4 4k:p-4 4k:mb-8 border`}>
      <p>
        Welcome to Do You Know SWU!
        <br/>Test your knowledge of the SWU TCG with a variety of question modes:
        <div className="w-3/4 uwd:w-1/2 4k:w-1/4 m-auto">
          <p className="text-sm text-left">
            Standard Mode: Choose a set number of questions to answer.
            <br/>Marathon Mode: Answer all questions in the databank correctly to complete the marathon.
            <br/>Endless Mode: Answer random questions with no end in sight.
            <br/>Difficulty Modes: Choose from Padawan (easy), Knight (medium), or Master (hard) question sets.
            <br/>Select a mode to get started and see how well you know the SWU TCG!
          </p>
        </div>
      </p>
    </div>
    {
      dykswuMode === "" || (dykswuMode === "standard" && standardQuestionLength === 0)
        ? <ModeButtons
          mode={dykswuMode}
          appModeSets={dykswuSets}
          standardModeLength={standardQuestionLength}
          modeDescriptions={modeDescriptions}
          setMode={setDykswuMode}
          initVariant={true}
          setCurrentModeSet={setCurrentQuestionSet as React.Dispatch<React.SetStateAction<AppModeSetEntry[]>>}
          setCurrentModeId={setCurrentQuestionId}
          setStandardModeLength={setStandardQuestionLength}
          setVariant={setCurrentVariant}
        />
        : renderQuestionContent()
    }
  </div>;
}

export default DoYouKnowSWUPage;
