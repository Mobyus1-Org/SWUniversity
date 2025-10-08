import React from "react";
import type { SfxType } from "./const";

export const AudioContext = React.createContext<{ sfx: (type: SfxType) => void } | null>(null);
export const AudioContextProvider = AudioContext.Provider;