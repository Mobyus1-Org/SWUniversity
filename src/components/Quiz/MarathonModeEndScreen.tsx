import type { QuizModes } from "../../util/const";
import type { Quiz } from "../../util/func";

interface IProps {
  setQuizzesCompleted: (completed: number[]) => void;
  setCurrentQuizId: (id: number) => void;
  setQuizResult: (result: boolean) => void;
  setSelectedAnswer: (answer: string) => void;
  setQuizMode: (mode: QuizModes) => void;
  setCurrentQuizKeys: (keys: string[]) => void;
  currentQuizSet: Quiz[];
}

export function MarathonModeEndScreen({
  setQuizzesCompleted,
  setCurrentQuizId,
  setQuizResult,
  setSelectedAnswer,
  setQuizMode,
  setCurrentQuizKeys,
  currentQuizSet
}: IProps) {
  return <div className="text-center m-[35%_10%] lg:m-[15%_10%]">
    <p className="text-2xl md:text-4xl font-bold mb-4 h-32">You've correctly answered every question!</p>
    <button className="btn btn-primary text-lg p-4" onClick={() => {
      setQuizzesCompleted([]);
      setCurrentQuizId(Math.floor(Math.random() * currentQuizSet.length));
      setQuizResult(false);
      setSelectedAnswer("");
      setCurrentQuizKeys([]);
      setQuizMode("");
    }}>Go Back to Quiz Menu</button>
  </div>
}