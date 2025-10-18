import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import { UserSettingsLocalStorageKey, type SfxType, type UserSettings } from './util/const';

import Layout from './Layout';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import DoYouKnowSWUPage from './pages/DoYouKnowSWUPage';
//import PuzzlesPage from './pages/PuzzlesPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';
import { AudioContextProvider, ModalContextProvider, type ModalKey } from './util/context';
import InternalPage from './pages/api/InternalPage';

function App() {
  const [showModal, setShowModal] = React.useState(false);
  const [modalKey, setModalKey] = React.useState<ModalKey>("");
  const [userSettings, setUserSettings] = React.useState<UserSettings>(() => {
    const defaultUserSettings: UserSettings = {
      soundEnabled: true
    };
    const savedSettings = localStorage.getItem(UserSettingsLocalStorageKey);
    return savedSettings ? JSON.parse(savedSettings) : defaultUserSettings;
  });
  const clickSound = React.useMemo(() => new Audio('/assets/sfx/click.mp3'), []);
  clickSound.volume = 0.04;
  const confirmSound = React.useMemo(() => new Audio('/assets/sfx/confirm.mp3'), []);
  confirmSound.volume = 0.03;
  const transitionSound = React.useMemo(() => new Audio('/assets/sfx/transition.mp3'), []);
  transitionSound.volume = 0.05;

  const sfx = (type: SfxType) => {
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
      default:
        return;
    }
    sound.currentTime = 0;
    if (userSettings.soundEnabled) {
      sound.play().catch((error) => {
        console.error("Error playing sound:", error);
      });
    }
  };

  return <HashRouter>
    <AudioContextProvider value={{ sfx }}>
      <ModalContextProvider value={{ showModal, modalKey, setShowModal, setModalKey }}>
        <Layout userSettings={userSettings} setUserSettings={setUserSettings}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/do-you-know-swu" element={<DoYouKnowSWUPage />} />
            {/* <Route path="/puzzles" element={<PuzzlesPage />} /> */}
            <Route path="/rpc/internal" element={<InternalPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </ModalContextProvider>
    </AudioContextProvider>
  </HashRouter>;
}

export default App;
