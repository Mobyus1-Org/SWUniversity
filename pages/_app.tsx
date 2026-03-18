import React from "react";
import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/react";

import "@/App.css";

import Layout from "@/Layout";
import { UserSettingsLocalStorageKey, type SfxType, type UserSettings } from "@/util/const";
import {
  AudioContextProvider,
  ModalContextProvider,
  UserSettingsContextProvider,
  type ModalData,
  type ModalKey,
} from "@/util/context";
import { LightsaberColors, setLightsaberColor } from "@/util/style-const";

const DEFAULT_USER_SETTINGS: UserSettings = {
  soundEnabled: true,
  lightsaberColor: "blue",
};

function createAudio(path: string, volume: number): HTMLAudioElement | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audio = new Audio(path);
  audio.volume = volume;
  return audio;
}

export default function App({ Component, pageProps }: AppProps) {
  const [showModal, setShowModal] = React.useState(false);
  const [modalKey, setModalKey] = React.useState<ModalKey>("");
  const [modalData, setModalData] = React.useState<ModalData>({});
  const [userSettings, setUserSettings] = React.useState<UserSettings>(DEFAULT_USER_SETTINGS);

  React.useEffect(() => {
    const savedSettings = localStorage.getItem(UserSettingsLocalStorageKey);
    const parsedSettings = savedSettings
      ? (JSON.parse(savedSettings) as UserSettings)
      : DEFAULT_USER_SETTINGS;

    if (
      parsedSettings.lightsaberColor &&
      Object.keys(LightsaberColors).includes(parsedSettings.lightsaberColor)
    ) {
      setLightsaberColor(parsedSettings.lightsaberColor);
    } else {
      parsedSettings.lightsaberColor = DEFAULT_USER_SETTINGS.lightsaberColor;
      setLightsaberColor(DEFAULT_USER_SETTINGS.lightsaberColor);
    }

    setUserSettings(parsedSettings);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(UserSettingsLocalStorageKey, JSON.stringify(userSettings));
  }, [userSettings]);

  const clickSound = React.useMemo(() => createAudio("/assets/sfx/click.mp3", 0.04), []);
  const confirmSound = React.useMemo(() => createAudio("/assets/sfx/confirm.mp3", 0.03), []);
  const transitionSound = React.useMemo(() => createAudio("/assets/sfx/transition.mp3", 0.05), []);
  const lightsaber1Sound = React.useMemo(() => createAudio("/assets/sfx/lightsaber1.mp3", 0.05), []);
  const lightsaberOffSound = React.useMemo(() => createAudio("/assets/sfx/lightsaberoff.mp3", 0.05), []);

  const sfx = React.useCallback(
    (type: SfxType, forcePlay = false) => {
      let sound: HTMLAudioElement | null;
      switch (type) {
        case "click":
          sound = clickSound;
          break;
        case "confirm":
          sound = confirmSound;
          break;
        case "transition":
          sound = transitionSound;
          break;
        case "lightsaber1":
          sound = lightsaber1Sound;
          break;
        case "lightsaberoff":
          sound = lightsaberOffSound;
          break;
        default:
          return;
      }

      if (!sound) {
        return;
      }

      sound.currentTime = 0;
      if (userSettings.soundEnabled || forcePlay) {
        sound.play().catch((error) => {
          console.error("Error playing sound:", error);
        });
      }
    },
    [clickSound, confirmSound, transitionSound, lightsaber1Sound, lightsaberOffSound, userSettings.soundEnabled],
  );

  return (
    <AudioContextProvider value={{ sfx }}>
      <UserSettingsContextProvider value={userSettings}>
        <ModalContextProvider
          value={{
            showModal,
            modalKey,
            setShowModal,
            setModalKey,
            modalData,
            setModalData,
          }}
        >
          <Layout userSettings={userSettings} setUserSettings={setUserSettings}>
            <Component {...pageProps} />
          </Layout>
          <Analytics />
        </ModalContextProvider>
      </UserSettingsContextProvider>
    </AudioContextProvider>
  );
}
