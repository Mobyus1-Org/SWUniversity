import React from "react";
import { getDoYouKnowSWUDataAsync, getModeTitle, preloadImagesAsync, type AppModeSetEntry, type DoYouKnowSWUQuestion, type UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuestionContent } from "../components/DoYouKnowSWU/QuestionContent";
import type { AppModes, ModeDescriptions } from "../util/const";

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

  React.useEffect(() => {
    getDoYouKnowSWUDataAsync().then(data => {
      setAllQuestions(data);
      if(sessionStorage.getItem("loadedDYKSWUData") === "true") {
        setLoading(false);
        return;
      }

      preloadImagesAsync(data.map((question) => question.actualCard)).then(() => {
        setLoading(false);
        sessionStorage.setItem("loadedDYKSWUData", "true");
      });
    });
  }, []);

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
