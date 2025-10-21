import type { AppModeSetEntry } from "../../util/func";
import { globalBackgroundStyle } from "../../util/style-const";
import { type AppModes, type ModeDescriptions } from "../../util/const";
import React from "react";
import { AudioContext } from "../../util/context";
import { ModeButtonItem } from "./ModeButtonItem";

interface IProps {
  mode: AppModes;
  appModeSets: {
    all: AppModeSetEntry[];
    padawan: AppModeSetEntry[];
    knight: AppModeSetEntry[];
    master: AppModeSetEntry[];
  };
  standardModeLength: number;
  modeDescriptions: ModeDescriptions;
  initVariant?: boolean;
  setMode: (mode: AppModes) => void;
  setCurrentModeSet: (set: AppModeSetEntry[]) => void;
  setCurrentModeId: (id: number) => void;
  setStandardModeLength: (length: number) => void;
  setVariant?: (variant: number) => void;
}

export function ModeButtons({mode, appModeSets, standardModeLength, modeDescriptions, initVariant,
    setMode, setCurrentModeSet, setCurrentModeId, setStandardModeLength, setVariant}: IProps) {
  const renderButtons = () => <div className="grid md:grid-cols-3 gap-4 uwd:gap-5 mb-8 h-full text-center">
    <ModeButtonItem
      mode="standard"
      title="Standard Mode"
      description={modeDescriptions["standard"]}
      modeSet={[]}
      initModeId={false}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
    <ModeButtonItem
      mode="iron-man"
      title="Iron Man Challenge"
      description={modeDescriptions["iron-man"]}
      modeSet={appModeSets.all}
      initModeId={true}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
    <ModeButtonItem
      mode="endless"
      title="Endless Mode"
      description={modeDescriptions["endless"]}
      modeSet={appModeSets.all}
      initModeId={true}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
    <ModeButtonItem
      mode="padawan"
      title="Padawan Mode"
      description={modeDescriptions["padawan"]}
      modeSet={appModeSets.padawan}
      initModeId={true}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
    <ModeButtonItem
      mode="knight"
      title="Jedi Knight Mode"
      description={modeDescriptions["knight"]}
      modeSet={appModeSets.knight}
      initModeId={true}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
    <ModeButtonItem
      mode="master"
      title="Jedi Master Mode"
      description={modeDescriptions["master"]}
      modeSet={appModeSets.master}
      initModeId={true}
      initVariant={initVariant}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
      setVariant={setVariant}
    />
  </div>

  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };

  return <div>
  {
    mode === "standard" && standardModeLength === 0
      ? <div className={`${globalBackgroundStyle} w-full md:w-1/2 px-5 py-8 md:m-[auto] border`}>
        <label className="text-2xl md:mr-24">Select number of questions:</label>
        <select
          className="rounded text-2xl w-full md:w-1/8 bg-[rgba(255,255,255,0.25)] mt-8 md:mt-0"
          onClick={() => sfx("click")}
          onChange={(e) => {
            sfx("click");
            setStandardModeLength(parseInt(e.target.value));
            const filteredSet = ([...appModeSets.all].sort(() => 0.5 - Math.random())).slice(0, parseInt(e.target.value));
            setCurrentModeSet(filteredSet);
            setCurrentModeId(filteredSet[0].id);
          }}
          defaultValue={0}
        >
          <option value={0} disabled></option>
          {
            [5, 10, 25].map(length => <option key={"q-length-" + length} value={length}>{length}</option>)
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
