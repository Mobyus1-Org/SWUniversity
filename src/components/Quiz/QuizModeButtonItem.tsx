import { globalBackgroundStyle, type QuizModes } from "../../util/const";
import type { Quiz } from "../../util/func";

interface IProps {
  quizMode: QuizModes;
  title: string;
  description: string;
  quizSet: Quiz[];
  initQuizId: boolean;
  setQuizMode: (mode: QuizModes) => void;
  setCurrentQuizSet: (set: Quiz[]) => void;
  setCurrentQuizId: (id: number) => void;
}

export function QuizModeButtonItem({ quizMode, title, description, quizSet, initQuizId, setQuizMode, setCurrentQuizSet, setCurrentQuizId }: IProps) {
  return <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
    <h3 className="text-xl mb-4">{description}</h3>
    <button
      className="btn btn-primary text-lg py-8 lg:py-5 w-1/2"
      onClick={() => {
        setQuizMode(quizMode);
        setCurrentQuizSet(quizSet);
        setCurrentQuizId(initQuizId ? quizSet[Math.floor(Math.random() * quizSet.length)].id : 0);
      }}
    >
      {title}
    </button>
  </div>
}