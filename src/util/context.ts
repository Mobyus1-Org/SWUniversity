import React from "react";
import type { SfxType } from "./const";

export const AudioContext = React.createContext<{ sfx: (type: SfxType) => void } | null>(null);
export const AudioContextProvider = AudioContext.Provider;
export type ModalKey = "" | "settings" | "relevant-cards";
type ModalContextProps = {
  modalKey: ModalKey;
  setModalKey: React.Dispatch<React.SetStateAction<ModalKey>>;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}
export const ModalContext = React.createContext<ModalContextProps | null>(null);
export const ModalContextProvider = ModalContext.Provider;