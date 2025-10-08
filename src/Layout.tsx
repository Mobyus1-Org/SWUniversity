import React from 'react';

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="layout">
    <main>
      <div className="relative navbar z-10">
        <div className="flex gap-4">
          <a className="btn btn-ghost text-xl" href="#/">Home</a>
          <a className="btn btn-ghost text-xl" href="#/quiz">Quiz</a>
          {/* <a className="btn btn-ghost text-xl" href="#/puzzles">Puzzle</a> */}
        </div>
      </div>
      <div className="relative p-4 z-10 min-h-[75vh]">
        {children}
      </div>
    </main>
    <footer className="text-center text-sm mt-8 border-t pt-4 space-y-2 text-gray-400 z-10 relative">
      <p className="p-2">For educational purposes only. Check out our <a href="https://discord.gg/dbQXnVkjFV" className="text-blue-500 underline">Discord server here</a>!</p>
      <p className="p-2">SWUniversity is in no way affiliated with Disney or Fantasy Flight Games. Star Wars characters, cards, logos, and art are property of Disney and/or Fantasy Flight Games.</p>
    </footer>
  </div>;
}

export default Layout;
