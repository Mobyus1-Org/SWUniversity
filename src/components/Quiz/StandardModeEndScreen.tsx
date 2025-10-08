import { globalBackgroundStyle } from "../../util/const";
import type { Quiz, UserResponse } from "../../util/func";

interface IProps {
  userResponses: UserResponse[];
  currentQuizSet: Quiz[];
  standardQuizLength: number;
  resetQuizMode: () => void;
}

export function StandardModeEndScreen({
  userResponses,
  currentQuizSet,
  standardQuizLength,
  resetQuizMode,
}: IProps) {
  return <div className="text-center m-[10%_10%] lg:m-[1%_10%]">
    <p className="text-2xl md:text-4xl font-bold mb-4 h-16">Quiz Complete! You answered {Object.values(userResponses).filter(response => response.selected === response.correct).length} out of {standardQuizLength} questions correctly.</p>
    <button className="btn btn-primary text-lg p-4" onClick={resetQuizMode}>Go Back to Quiz Menu</button>
    <div className={"mt-8 text-left p-8 " + globalBackgroundStyle}>
      <summary className="text-xl font-bold mb-4 cursor-pointer">Your Answers:</summary>
        <div className="mt-4 max-h-140 overflow-y-scroll">
          {
            userResponses.map((response) => {
              const quiz = currentQuizSet.find(q => q.id === response.quizId)!;

              return <div key={response.quizId} className="mb-6 p-4 border rounded">
                <p className="font-bold">Q: {quiz.question}</p>
                <p>Your answer: <span className={response.selected === response.correct ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{quiz.choices[response.selected]}</span></p>
                {response.selected !== response.correct && <p>Correct answer: <span className="text-green-500 font-bold">{quiz.choices[response.correct]}</span></p>}
              </div>;
            })
          }
      </div>
    </div>
  </div>;
}
