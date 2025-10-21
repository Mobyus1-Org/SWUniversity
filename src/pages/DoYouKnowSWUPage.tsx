import React from "react";
import { getDoYouKnowSWUDataAsync, getModeTitle, preloadImagesAsync, type AppModeSetEntry, type DoYouKnowSWUQuestion, type UserResponse } from "../util/func";
import { ModeButtons } from "../components/Shared/ModeButtons";
import { QuestionContent } from "../components/DoYouKnowSWU/QuestionContent";
import { globalBackgroundStyle } from "../util/style-const";
import { type AppModes, type ModeDescriptions } from "../util/const";
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
  const [questionsEnded, setQuestionsEnded] = React.useState<boolean>(false);
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

  React.useEffect(() => {
    setQuestionsEnded(false);
  }, [dykswuMode])

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
      questionsEnded={questionsEnded}
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
      setQuestionsEnded={setQuestionsEnded}
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
    "iron-man": `Attempt to identify every card in the databank to complete the Iron Man challenge!\n\nTotal Cards: ${dykswuSets.all.length}`,
    "endless": "Continue to be shown random cards with no end in sight!",
    "standard": "Select a number of cards and see how many you know!\nReceive a score at the end!",
    "padawan": `Cards in this mode are fairly easy!\n\nTotal Cards: ${dykswuSets.padawan.length}`,
    "knight": `Cards in this mode are somewhat tricky!\n\nTotal Cards: ${dykswuSets.knight.length}`,
    "master": `Cards in this mode are very challenging!\n\nTotal Cards: ${dykswuSets.master.length}`,
  };

  return <div>
    <h1 className="text-center text-4xl font-bold md:text-4xl uwd:!text-5xl 4k:!text-7xl mb-4">{getModeTitle("dykswu", dykswuMode)}</h1>
    {
      dykswuMode === "" && <div className={`${globalBackgroundStyle}
        xl:w-3/4 m-auto text-xl uwd:text-3xl 4k:text-5xl text-center
        md:flex justify-center p-2 mb-4 4k:p-4 4k:mb-8 border`}>
      <img src="/assets/dykswu-mode-splash.png" alt="Do You Know SWU?" className="md:w-2/5 p-8 my-auto uwd:mb-8 4k:mb-12" />
      <div>
        <p>
          Welcome to "Do You Know SWU?"!
          <br/>How well do you know the details of SWU cards? Find out!
        </p>
        <div className="md:w-3/4 uwd:w-1/2 4k:w-1/4 m-auto">
          <p className="text-sm text-left">
            <br/>-Standard, Marathon, and Endless pull cards randomly from our entire databank (no filtering).
            <br/><br/>-Padawan (easy), Knight (medium), or Master (hard) modes will filter selected cards to those difficulties.
            <br/><br/>-Be careful! Some cards have multiple variants!
            <br/>Just because you may see the same card twice doesn't mean the answer will be the same!
            <br/><br/>-Inspired by Mobyus1's YouTube series!
          </p>
        </div>
      </div>
    </div>
    }
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
