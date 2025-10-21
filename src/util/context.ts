import React from "react";
import type { SfxType, UserSettings } from "./const";
import type { Quiz } from "./func";

export const AudioContext = React.createContext<{ sfx: (type: SfxType, forcePlay?: boolean) => void } | null>(null);
export const AudioContextProvider = AudioContext.Provider;

export const UserSettingsContext = React.createContext<UserSettings | null>(null);
export const UserSettingsContextProvider = UserSettingsContext.Provider;

export type ModalKey = "" | "settings" | "relevant-cards";
export type ModalData = {
  currentQuiz?: Quiz;
}
export type ModalContextProps = {
  modalKey: ModalKey;
  setModalKey: React.Dispatch<React.SetStateAction<ModalKey>>;
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  modalData: ModalData;
  setModalData: React.Dispatch<React.SetStateAction<ModalData>>;
}
export const ModalContext = React.createContext<ModalContextProps | null>(null);
export const ModalContextProvider = ModalContext.Provider;