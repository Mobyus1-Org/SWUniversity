import React from "react";
import { globalBackgroundStyle } from "../../util/style-const";
import { type AppModes } from "../../util/const";
import type { AppModeSetEntry, DoYouKnowSWUQuestion } from "../../util/func";
import { AudioContext } from "../../util/context";

interface IProps {
  mode: AppModes;
  title: string;
  description: string;
  modeSet: AppModeSetEntry[];
  initModeId: boolean;
  initVariant?: boolean;
  setMode: (mode: AppModes) => void;
  setCurrentModeSet: (set: AppModeSetEntry[]) => void;
  setCurrentModeId: (id: number) => void;
  setVariant?: (variant: number) => void;
}

export function ModeButtonItem({mode, title, description, modeSet, initModeId, initVariant, setMode, setCurrentModeSet, setCurrentModeId, setVariant }: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  return <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1 4k:p-8 4k:m-4`}>
    {
      title !== "" && <button
      className="btn btn-primary text-lg xl:text-2xl uwd:!text-3xl 4k:!text-5xl py-8 lg:py-6 xl:py-8 uwd:!py-10 4k:!py-20 w-1/2"
        onClick={() => {
          sfx("confirm");
          setMode(mode);
          setCurrentModeSet(modeSet);
          setCurrentModeId(initModeId ? modeSet[Math.floor(Math.random() * modeSet.length)].id : 0);
          if(initVariant && setVariant) {
            const q = modeSet[initModeId ? Math.floor(Math.random() * modeSet.length) : 0] as DoYouKnowSWUQuestion;
            setVariant(Math.floor(Math.random() * q.variants.length));
          }
        }}
      >
        {title}
      </button>
    }
    <h3 className="text-xl xl:text-2xl uwd:!text-3xl 4k:!text-5xl 4k:!p-5 mt-4">{description.split("\n").map((line, index) => <span key={"desc-line-" + index}>{line}<br /></span>)}</h3>
  </div>
}
