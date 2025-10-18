import React from 'react';
import { globalBackgroundStyle, globalBackgroundStyleOpaque, type UserSettings } from './util/const';
import { AudioContext, ModalContext } from './util/context';
import { updateUserSettings } from './util/func';

interface IProps {
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  children: React.ReactNode;
}

function Layout({ userSettings, setUserSettings, children }: IProps) {
  const defaultModalContext = { showModal: false, modalKey: "", setShowModal: () => {}, setModalKey: () => {} };
  const { showModal, modalKey, setShowModal, setModalKey } = React.useContext(ModalContext) ?? defaultModalContext;
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  const [mobileNav, setMobileNav] = React.useState(false);
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.hash === e.currentTarget.getAttribute('href')) {
      e.preventDefault();
      return;
    }
    sfx("transition");
    setMobileNav(false);
    setModalKey("");
    setShowModal(false);
  }

  const MenuButton = () => <label className="btn btn-ghost btn-circle">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="square" strokeLinejoin="round" strokeWidth="4" d="M4 4h16M4 12h16M4 20h16M4" />
    </svg>
  </label>

  return <div className="layout">
    <main>
      <div className={`relative navbar z-10 border-b ${globalBackgroundStyle}`}>
        <div className="flex justify-between items-center w-full px-4">
          {/* Left side links */}
          <div className="md:hidden" onClick={() => setMobileNav((p) => !p)}><MenuButton /></div>
          <div className="hidden md:block flex w-11/16 gap-1 md:gap-8 uwd:!gap-24 4k:!gap-30 uwd:py-4 4k:py-10 overflow-x-scroll">
            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/" onClick={handleNavClick}>Home</a>
            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/quiz" onClick={handleNavClick}>Quiz</a>
            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl flex-col" href="#/do-you-know-swu" onClick={handleNavClick}>DYKSWU?</a>
            {/* <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/puzzles">Puzzles</a> */}
          </div>
          {/* Right side tray */}
          <div className="text-md md:text-xl uwd:!text-2xl 4k:!text-3xl btn btn-ghost relative right-32 uwd:right-48 4k:right-64"
            onClick={() => { setShowModal((p) => !p); setModalKey("settings"); }}
          >
            Settings
          </div>
          <div className="flex items-center gap-4 uwd:gap-6 4k:gap-8 bg-opacity-50 py-1 px-5 4k:px-8 4k:py-4 uwd:px-6
              bg-[rgba(255,255,255,0.25)] rounded-full absolute right-2 uwd:right-4 4k:right-8 top-1/2 transform -translate-y-1/2">
            <a
              href="https://discord.gg/dbQXnVkjFV"
              target="_blank"
              rel="noopener noreferrer"
              className="relative"
              aria-label="Join our Discord"
            >
              <img src="/assets/Discord-logo2.png" alt="Discord" className="w-8 lg:w-10 uwd:!w-14 4k:!w-20" />
            </a>
            <a
              href="https://www.patreon.com/mobyus1"
              target="_blank"
              rel="noopener noreferrer"
              className="relative"
              aria-label="Support us on Patreon"
            >
              <img src="/assets/PatreonIcon.png" alt="Patreon" className="w-6 lg:w-8 uwd:!w-11 4k:!w-15" />
            </a>
          </div>
        </div>
      </div>
      <div className="relative p-4 z-10 min-h-[75vh]">
        {children}
      </div>
    </main>
    {
      modalKey !== "relevant-cards" && <footer className="text-center text-sm uwd:text-lg 4k:text-2xl mt-8 border-t pt-4 space-y-2 text-gray-400 z-10 relative">
        <p className="p-2">For educational purposes only. Check out our <a href="https://discord.gg/dbQXnVkjFV" className="text-blue-500 underline">Discord server here</a>!</p>
        <p className="p-2">SWUniversity is in no way affiliated with Disney or Fantasy Flight Games. Star Wars characters, cards, logos, and art are property of Disney and/or Fantasy Flight Games.</p>
      </footer>
    }
    {
      showModal && modalKey === "settings" && <div role="dialog" aria-modal="true" className={`z-10 text-sm md:text-lg uwd:!text-xl 4k:!text-2xl
          ${globalBackgroundStyleOpaque} border p-4 absolute top-16 right-32 uwd:right-48 4k:right-64`}
      >
        <div onClick={() => {updateUserSettings(setUserSettings, {soundEnabled: !userSettings.soundEnabled})}}
          className="flex items-center gap-4 uwd:gap-6 4k:gap-8 cursor-pointer"
        >
          {
            userSettings.soundEnabled
              ? <img src="/assets/speaker1.png" alt="Sound On" className="w-6 lg:w-8 uwd:!w-11 4k:!w-15" />
              : <img src="/assets/speaker2.png" alt="Sound Off" className="w-6 lg:w-8 uwd:!w-11 4k:!w-15" />
          }
          <label className="cursor-pointer">Enable Sound Effects</label>
        </div>
      </div>
    }
    {
      mobileNav && <div className={`fixed top-0 left-0 z-50 h-1/2 w-1/2 md:w-1/4 z-20 border-r border-b p-4 ${globalBackgroundStyleOpaque}`}
        onClick={() => setMobileNav(false)}
      >
        <div className="w-1/4 mx-auto mb-8" onClick={() => setMobileNav(false)}>
          <MenuButton />
        </div>
        <div className="flex flex-col gap-4 mt-8">
          <a className="btn btn-outline text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/" onClick={handleNavClick}>Home</a>
          <a className="btn btn-outline text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/quiz" onClick={handleNavClick}>Quiz</a>
          <a className="btn btn-outline text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl flex-col" href="#/do-you-know-swu" onClick={handleNavClick}>DYKSWU?</a>
          {/* <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/puzzles">Puzzles</a> */}
        </div>
      </div>
    }
  </div>;
}

export default Layout;
