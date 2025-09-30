import React from "react";

import type { SWUniversityApp } from "../../util/const";

import { AudioContext } from "../../util/context";

interface IProps {
  app: SWUniversityApp;
  resetQuizMode?: () => void;
  resetDykSWUMode?: () => void;
}

export function MarathonModeEndScreen({
  app,
  resetQuizMode,
  resetDykSWUMode,
}: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  return <div className="text-center m-[35%_10%] lg:m-[15%_10%]">
    <p className="text-2xl md:text-4xl font-bold mb-4 h-32">You've answered every question!</p>
    <button className="btn btn-primary text-lg p-4" onClick={() => {
      sfx("confirm");
      switch (app) {
        case "quiz":
          resetQuizMode?.();
          break;
        case "dykswu":
          resetDykSWUMode?.();
          break;
        default:
          break;
      }
      }}>Go Back to Page Menu</button>
  </div>
}
