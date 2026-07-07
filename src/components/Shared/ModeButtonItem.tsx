import React from "react";
import { globalBackgroundStyle } from "@/util/style-const";
import { type AppModes } from "@/util/const";
import type { AppModeSetEntry, DoYouKnowSWUQuestion } from "@/util/func";
import { AudioContext } from "@/util/context";

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
  loggedIn?: boolean;
  isFinished?: (entry: AppModeSetEntry, mode: AppModes) => boolean;
}

export function ModeButtonItem({mode, title, description, modeSet, initModeId, initVariant, setMode, setCurrentModeSet, setCurrentModeId, setVariant, loggedIn, isFinished }: IProps) {
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  const isDifficultyMode = mode === "padawan" || mode === "knight" || mode === "master";
  const [notFinishedOnly, setNotFinishedOnly] = React.useState(false);
  const [allFinishedMessage, setAllFinishedMessage] = React.useState(false);
  const notFinishedCount = (isDifficultyMode && isFinished)
    ? modeSet.filter((entry) => !isFinished(entry, mode)).length
    : modeSet.length;
  const displayDescription = notFinishedOnly
    ? description.replace(/(Total (?:Questions|Cards): )\d+/, `$1${notFinishedCount}`)
    : description;
  return <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1 4k:p-8 4k:m-4`}>
    {
      title !== "" && <button
      className="btn btn-primary text-lg xl:text-2xl uwd:!text-3xl 4k:!text-5xl py-8 lg:py-6 xl:py-8 uwd:!py-10 4k:!py-20 w-1/2"
        onClick={() => {
          const useFilter = isDifficultyMode && notFinishedOnly && !!isFinished;
          const activeSet = useFilter
            ? modeSet.filter((entry) => isFinished ? !isFinished(entry, mode) : true)
            : modeSet;

          if (useFilter && activeSet.length === 0) {
            setAllFinishedMessage(true);
            return;
          }
          setAllFinishedMessage(false);

          sfx("confirm");
          setMode(mode);
          setCurrentModeSet(activeSet);
          setCurrentModeId(initModeId ? activeSet[Math.floor(Math.random() * activeSet.length)].id : 0);
          if(initVariant && setVariant) {
            const item = activeSet[initModeId ? Math.floor(Math.random() * activeSet.length) : 0];
            if (item && "variants" in item) {
              const q = item as DoYouKnowSWUQuestion;
              setVariant(Math.floor(Math.random() * q.variants.length));
            }
          }
        }}
      >
        {title}
      </button>
    }
    {
      isDifficultyMode && loggedIn && <label className="mt-3 flex items-center justify-center gap-2 text-base cursor-pointer">
        <input
          type="checkbox"
          checked={notFinishedOnly}
          onChange={(e) => { sfx("click"); setNotFinishedOnly(e.target.checked); setAllFinishedMessage(false); }}
        />
        Not Finished Only
      </label>
    }
    {
      allFinishedMessage && <p className="mt-2 text-center text-yellow-400">You&apos;ve finished every card here!</p>
    }
    <h3 className="text-xl xl:text-2xl uwd:!text-3xl 4k:!text-5xl 4k:!p-5 mt-4">{displayDescription.split("\n").map((line, index) => <span key={"desc-line-" + index}>{line}<br /></span>)}</h3>
  </div>
}
