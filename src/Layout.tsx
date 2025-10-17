import React from 'react';
import { globalBackgroundStyle } from './util/const';
import { AudioContext, ModalContext } from './util/context';

function Layout({ children }: { children: React.ReactNode }) {
  const { showModal } = React.useContext(ModalContext) ?? { showModal: false };
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.hash === e.currentTarget.getAttribute('href')) {
      e.preventDefault();
      return;
    }
    sfx("transition");
  }

  return <div className="layout">
    <main>
      <div className={`relative navbar z-10 border-b ${globalBackgroundStyle}`}>
        <div className="flex justify-between items-center w-full px-4">
          {/* Left side links */}
          <div className="flex gap-4 uwd:py-4 4k:py-10">
            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/" onClick={handleNavClick}>Home</a>
            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/quiz" onClick={handleNavClick}>Quiz</a>

            <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl flex-col" href="#/do-you-know-swu" onClick={handleNavClick}>DYKSWU?</a>
            {/* <a className="btn btn-ghost text-xl md:text-3xl uwd:!text-4xl 4k:!text-7xl" href="#/puzzles">Puzzles</a> */}
          </div>
          {/* Right side tray */}
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
      !showModal &&<footer className="text-center text-sm uwd:text-lg 4k:text-2xl mt-8 border-t pt-4 space-y-2 text-gray-400 z-10 relative">
        <p className="p-2">For educational purposes only. Check out our <a href="https://discord.gg/dbQXnVkjFV" className="text-blue-500 underline">Discord server here</a>!</p>
        <p className="p-2">SWUniversity is in no way affiliated with Disney or Fantasy Flight Games. Star Wars characters, cards, logos, and art are property of Disney and/or Fantasy Flight Games.</p>
      </footer>
    }
  </div>;
}

export default Layout;
