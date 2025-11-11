import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { UserSettingsLocalStorageKey, type SfxType, type UserSettings } from './util/const';

import Layout from './Layout';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import DoYouKnowSWUPage from './pages/DoYouKnowSWUPage';
//import PuzzlesPage from './pages/PuzzlesPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';
import { AudioContextProvider, ModalContextProvider, UserSettingsContextProvider, type ModalData, type ModalKey } from './util/context';
import InternalPage from './pages/api/InternalPage';
import { LightsaberColors, setLightsaberColor } from './util/style-const';
import AboutPage from './pages/AboutPage';
import ResourcesPage from './pages/ResourcesPage';

function App() {
  const [showModal, setShowModal] = React.useState(false);
  const [modalKey, setModalKey] = React.useState<ModalKey>("");
  const [userSettings, setUserSettings] = React.useState<UserSettings>(() => {
    const defaultUserSettings: UserSettings = {
      soundEnabled: true,
      lightsaberColor: 'blue',
    };
    const savedSettings = localStorage.getItem(UserSettingsLocalStorageKey);
    const parsedSettings = savedSettings ? JSON.parse(savedSettings) : defaultUserSettings;

    if(parsedSettings.lightsaberColor && Object.keys(LightsaberColors).includes(parsedSettings.lightsaberColor)) {
      setLightsaberColor(parsedSettings.lightsaberColor);
    } else {
      parsedSettings.lightsaberColor = defaultUserSettings.lightsaberColor;
      setLightsaberColor(defaultUserSettings.lightsaberColor);
    }

    return parsedSettings;
  });
  const [modalData, setModalData] = React.useState<ModalData>({});
  const clickSound = React.useMemo(() => new Audio('/assets/sfx/click.mp3'), []);
  clickSound.volume = 0.04;
  const confirmSound = React.useMemo(() => new Audio('/assets/sfx/confirm.mp3'), []);
  confirmSound.volume = 0.03;
  const transitionSound = React.useMemo(() => new Audio('/assets/sfx/transition.mp3'), []);
  transitionSound.volume = 0.05;
  const lightsaber1Sound = React.useMemo(() => new Audio('/assets/sfx/lightsaber1.mp3'), []);
  lightsaber1Sound.volume = 0.05;
  const lightsaberOffSound = React.useMemo(() => new Audio('/assets/sfx/lightsaberoff.mp3'), []);
  lightsaberOffSound.volume = 0.05;

  const sfx = (type: SfxType, forcePlay = false) => {
    let sound: HTMLAudioElement;
    switch(type) {
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
    sound.currentTime = 0;
    if (userSettings.soundEnabled || forcePlay) {
      sound.play().catch((error) => {
        console.error("Error playing sound:", error);
      });
    }
  };

  return <BrowserRouter>
    <AudioContextProvider value={{ sfx }}>
      <UserSettingsContextProvider value={userSettings}>
        <ModalContextProvider value={{ showModal, modalKey, setShowModal, setModalKey, modalData, setModalData }}>
          <Layout userSettings={userSettings} setUserSettings={setUserSettings}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/do-you-know-swu" element={<DoYouKnowSWUPage />} />
              {/* <Route path="/puzzles" element={<PuzzlesPage />} /> */}
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/rpc/internal" element={<InternalPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </ModalContextProvider>
      </UserSettingsContextProvider>
    </AudioContextProvider>
  </BrowserRouter>;
}

export default App;
