import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import type { SfxType } from './util/const';

import Layout from './Layout';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
//import PuzzlesPage from './pages/PuzzlesPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';
import { AudioContextProvider } from './util/context';

function App() {
  const clickSound = React.useMemo(() => new Audio('/assets/sfx/click.mp3'), []);
  //clickSound.volume = 0.50;
  const confirmSound = React.useMemo(() => new Audio('/assets/sfx/confirm.mp3'), []);
  //confirmSound.volume = 0.50;
  const transitionSound = React.useMemo(() => new Audio('/assets/sfx/transition.mp3'), []);
  //transitionSound.volume = 0.50;

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
    sound.play().catch((error) => {
      console.error("Error playing sound:", error);
    });
  };

  return <HashRouter>
    <AudioContextProvider value={{ sfx }}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          {/* <Route path="/puzzles" element={<PuzzlesPage />} /> */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </AudioContextProvider>
  </HashRouter>;
}

export default App;
