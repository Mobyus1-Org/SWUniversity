import type { Quiz } from "../../util/func";
import { globalBackgroundStyle, type QuizModes } from "../../util/const";
import { QuizModeButtonItem } from "./QuizModeButtonItem";

interface IProps {
  quizMode: QuizModes;
  allQuizzes: Quiz[];
  standardQuizLength: number;
  setQuizMode: (mode: QuizModes) => void;
  setCurrentQuizSet: (set: Quiz[]) => void;
  setCurrentQuizId: (id: number) => void;
  setStandardQuizLength: (length: number) => void;
}

export function QuizModeButtons({quizMode, allQuizzes, standardQuizLength, setQuizMode, setCurrentQuizSet, setCurrentQuizId, setStandardQuizLength}: IProps) {
  const renderButtons = () => <div className="flex flex-col md:flex-row gap-4 mb-8 h-full">
    <QuizModeButtonItem
      quizMode="standard"
      title="Standard Mode"
      description="Choose a number of questions and see how many you can answer correctly!"
      quizSet={[]}
      initQuizId={false}
      setQuizMode={setQuizMode}
      setCurrentQuizSet={setCurrentQuizSet}
      setCurrentQuizId={setCurrentQuizId}
    />
    <QuizModeButtonItem
      quizMode="newplayer"
      title="New Player Mode"
      description="A perfect place for new players to test their knowledge of the basics of SWU!"
      quizSet={allQuizzes.filter(quiz => quiz.difficulty === 0)}
      initQuizId={true}
      setQuizMode={setQuizMode}
      setCurrentQuizSet={setCurrentQuizSet}
      setCurrentQuizId={setCurrentQuizId}
    />
    <QuizModeButtonItem
      quizMode="marathon"
      title="Marathon Mode"
      description="Correctly answer every question in the database once to complete the marathon!"
      quizSet={allQuizzes}
      initQuizId={true}
      setQuizMode={setQuizMode}
      setCurrentQuizSet={setCurrentQuizSet}
      setCurrentQuizId={setCurrentQuizId}
    />
    <QuizModeButtonItem
      quizMode="endless"
      title="Endless Mode"
      description="Answer random questions with no end in sight!"
      quizSet={allQuizzes}
      initQuizId={true}
      setQuizMode={setQuizMode}
      setCurrentQuizSet={setCurrentQuizSet}
      setCurrentQuizId={setCurrentQuizId}
    />
  </div>

  return <div>
  {
    quizMode === "standard" && standardQuizLength === 0
      ? <div className={`${globalBackgroundStyle} w-full md:w-1/2 px-5 py-8 md:m-[auto]`}>
        <label className="text-2xl md:mr-24">Select number of questions:</label>
        <select
          className="rounded text-2xl w-full md:w-1/8 bg-[rgba(255,255,255,0.25)] mt-8 md:mt-0"
          onChange={(e) => {
            setStandardQuizLength(parseInt(e.target.value));
            const filteredSet = ([...allQuizzes].sort(() => 0.5 - Math.random())).slice(0, parseInt(e.target.value));
            setCurrentQuizSet(filteredSet);
            setCurrentQuizId(filteredSet[0].id);
          }}
          defaultValue={0}
        >
          <option value={0} disabled></option>
          {
            [5, 10].map(length => <option key={length} value={length}>{length}</option>)
          }
        </select>
      </div>
      : null
  }
  {
    quizMode === "" ? renderButtons() : null
  }
  </div>;
}
