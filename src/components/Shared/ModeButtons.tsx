import type { AppModeSetEntry } from "../../util/func";
import { globalBackgroundStyle, type AppModes, type ModeDescriptions } from "../../util/const";
import React from "react";
import { AudioContext } from "../../util/context";
import { ModeButtonItem } from "./ModeButtonItem";

interface IProps {
  mode: AppModes;
  allModeSet: AppModeSetEntry[];
  standardModeLength: number;
  modeDescriptions: ModeDescriptions;
  setMode: (mode: AppModes) => void;
  setCurrentModeSet: (set: AppModeSetEntry[]) => void;
  setCurrentModeId: (id: number) => void;
  setStandardModeLength: (length: number) => void;
}

export function ModeButtons({mode, allModeSet, standardModeLength, modeDescriptions, setMode, setCurrentModeSet, setCurrentModeId, setStandardModeLength}: IProps) {
  const padawanModeSet = allModeSet.filter(quiz => quiz.difficulty === 0);
  const knightModeSet = allModeSet.filter(quiz => quiz.difficulty === 1);
  const masterModeSet = allModeSet.filter(quiz => quiz.difficulty === 2);
  const renderButtons = () => <div className="grid md:grid-cols-3 gap-4 uwd:gap-5 mb-8 h-full" style={{ textAlign: 'center' }}>
    <ModeButtonItem
      mode="standard"
      title="Standard Mode"
      description={modeDescriptions["standard"]}
      modeSet={[]}
      initModeId={false}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="marathon"
      title="Marathon Mode"
      description={modeDescriptions["marathon"]}
      modeSet={allModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="endless"
      title="Endless Mode"
      description={modeDescriptions["endless"]}
      modeSet={allModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="padawan"
      title="Padawan Mode"
      description={modeDescriptions["padawan"]}
      modeSet={padawanModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="knight"
      title="Jedi Knight Mode"
      description={modeDescriptions["knight"]}
      modeSet={knightModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="master"
      title="Jedi Master Mode"
      description={modeDescriptions["master"]}
      modeSet={masterModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
  </div>

  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };

  return <div>
  {
    mode === "standard" && standardModeLength === 0
      ? <div className={`${globalBackgroundStyle} w-full md:w-1/2 px-5 py-8 md:m-[auto]`}>
        <label className="text-2xl md:mr-24">Select number of questions:</label>
        <select
          className="rounded text-2xl w-full md:w-1/8 bg-[rgba(255,255,255,0.25)] mt-8 md:mt-0"
          onClick={() => sfx("click")}
          onChange={(e) => {
            sfx("click");
            setStandardModeLength(parseInt(e.target.value));
            const filteredSet = ([...allModeSet].sort(() => 0.5 - Math.random())).slice(0, parseInt(e.target.value));
            setCurrentModeSet(filteredSet);
            setCurrentModeId(filteredSet[0].id);
          }}
          defaultValue={0}
        >
          <option value={0} disabled></option>
          {
            [5, 10, 25].map(length => <option key={length} value={length}>{length}</option>)
          }
        </select>
      </div>
      : null
  }
  {
    mode === "" ? renderButtons() : null
  }
  </div>;
}
