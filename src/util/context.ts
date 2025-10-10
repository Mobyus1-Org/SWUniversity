import React from "react";
import type { SfxType } from "./const";

export const AudioContext = React.createContext<{ sfx: (type: SfxType) => void } | null>(null);
export const AudioContextProvider = AudioContext.Provider;

export const ModalContext = React.createContext<{ showModal: boolean; setShowModal: (show: boolean) => void } | null>(null);
export const ModalContextProvider = ModalContext.Provider;