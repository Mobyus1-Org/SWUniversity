import type { AppModeSetEntry } from "../../util/func";
import { globalBackgroundStyle, type AppModes } from "../../util/const";
import React from "react";
import { AudioContext } from "../../util/context";
import { ModeButtonItem } from "./ModeButtonItem";

interface IProps {
  mode: AppModes;
  allModeSet: AppModeSetEntry[];
  standardModeLength: number;
  setMode: (mode: AppModes) => void;
  setCurrentModeSet: (set: AppModeSetEntry[]) => void;
  setCurrentModeId: (id: number) => void;
  setStandardModeLength: (length: number) => void;
}

export function ModeButtons({mode, allModeSet, standardModeLength, setMode, setCurrentModeSet, setCurrentModeId, setStandardModeLength}: IProps) {
  const padawanModeSet = allModeSet.filter(quiz => quiz.difficulty === 0);
  const knightModeSet = allModeSet.filter(quiz => quiz.difficulty === 1);
  const masterModeSet = allModeSet.filter(quiz => quiz.difficulty === 2);
  const renderButtons = () => <div className="grid md:grid-cols-3 gap-4 uwd:gap-5 mb-8 h-full" style={{ textAlign: 'center' }}>
    <ModeButtonItem
      mode="standard"
      title="Standard Mode"
      description="Choose a set number of questions to be pulled from our databank and see how many you can answer correctly!"
      modeSet={[]}
      initModeId={false}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="marathon"
      title="Marathon Mode"
      description={`Correctly answer every question in the databank once to complete the marathon!\n\nTotal Questions: ${allModeSet.length}`}
      modeSet={allModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="endless"
      title="Endless Mode"
      description="Answer random questions with no end in sight!"
      modeSet={allModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="padawan"
      title="Padawan Mode"
      description={`A perfect place for new players to test their knowledge of the basics of SWU!\n\nTotal Questions: ${padawanModeSet.length}`}
      modeSet={padawanModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="knight"
      title="Jedi Knight Mode"
      description={`The majority of our questions fall under this category.\nSee how many you know!\n\nTotal Questions: ${knightModeSet.length}`}
      modeSet={knightModeSet}
      initModeId={true}
      setMode={setMode}
      setCurrentModeSet={setCurrentModeSet}
      setCurrentModeId={setCurrentModeId}
    />
    <ModeButtonItem
      mode="master"
      title="Jedi Master Mode"
      description={`Only the SWU players strongest in the Force understand these obscure interactions. And now you will too!\n\nTotal Questions: ${masterModeSet.length}`}
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
