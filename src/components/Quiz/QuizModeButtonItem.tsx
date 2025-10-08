import React from "react";
import { globalBackgroundStyle, type QuizModes } from "../../util/const";
import type { Quiz } from "../../util/func";
import { AudioContext } from "../../util/context";

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
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  return <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
    <h3 className="text-xl mb-4">{description.split("\\n").map((line, index) => <span key={index}>{line}<br /></span>)}</h3>
    {
      title !== "" && <button
        className="btn btn-primary text-md xl:text-lg py-8 lg:py-5 w-1/2"
        onClick={() => {
          sfx("confirm");
          setQuizMode(quizMode);
          setCurrentQuizSet(quizSet);
          setCurrentQuizId(initQuizId ? quizSet[Math.floor(Math.random() * quizSet.length)].id : 0);
        }}
      >
        {title}
      </button>
    }
  </div>
}