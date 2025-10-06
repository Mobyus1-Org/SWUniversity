import type { Quiz } from "../../util/func";
import { globalBackgroundStyle, type QuizModes } from "../../util/const";

interface IProps {
  quizMode: QuizModes;
  allQuizzes: Quiz[];
  marathonSet: number[];
  standardQuizLength: number;
  setQuizMode: (mode: QuizModes) => void;
  setCurrentQuizSet: (set: Quiz[]) => void;
  setCurrentQuizId: (id: number) => void;
  setStandardQuizLength: (length: number) => void;
}

export function QuizModeButtons({quizMode, allQuizzes, marathonSet, standardQuizLength, setQuizMode, setCurrentQuizSet, setCurrentQuizId, setStandardQuizLength}: IProps) {
  const renderButtons = () => <>
  <div className="flex flex-col md:flex-row gap-2 mb-8 h-full">
      <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
        <h3 className="text-xl mb-4">Choose a number of questions and see how many you can answer correctly!</h3>
        <button
          className="btn btn-primary text-lg py-8 lg:py-5 w-1/2"
          onClick={() => {
            setQuizMode("standard");
            setCurrentQuizSet([]);
            setCurrentQuizId(0);
          }}
        >
          Standard Mode
        </button>
      </div>

      <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
        <h3 className="text-xl mb-4">A perfect place for new players to test their knowledge of the basics of SWU!</h3>
        <button
          className="btn btn-primary text-lg py-8 lg:py-5 w-1/2"
          onClick={() => {
            setQuizMode("newplayer");
            setCurrentQuizSet([]);
            setCurrentQuizId(0);
          }}
        >
          New Player Mode
        </button>
      </div>

      <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
        <h3 className="text-xl mb-4">Correctly answer every question in the database once to complete the marathon!</h3>
        <button
          className="btn btn-primary text-lg py-8 lg:py-5 w-1/2"
          onClick={() => {
            setQuizMode("marathon");
            const filteredSet = allQuizzes.filter(quiz => marathonSet.includes(quiz.id));
            setCurrentQuizSet(filteredSet);
            setCurrentQuizId(Math.floor(Math.random() * filteredSet.length));
          }}
        >
          Marathon Mode
        </button>
      </div>

      <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
        <h3 className="text-xl mb-4">Answer random questions with no end in sight!</h3>
        <button
          className="btn btn-primary text-lg py-8 lg:py-5 w-1/2"
          onClick={() => {
            setQuizMode("endless");
            setCurrentQuizSet(allQuizzes);
            setCurrentQuizId(Math.floor(Math.random() * allQuizzes.length));
          }}
        >
          Endless Mode
        </button>
      </div>
    </div>
  </>

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
