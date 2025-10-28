import { Link } from "react-router-dom";
import type { SfxType } from "../../util/const";
import { globalBackgroundStyleOpaque } from "../../util/style-const";

interface IProps {
  sfx: (type: SfxType, forcePlay?: boolean) => void;
  playModesRef: React.RefObject<HTMLDivElement | null>;
  styles: {
    desktopNavLink: string;
    mobileNavLink: string;
  };
  currentHover: string;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, path: string) => void;
  showPlayModesDropdown: boolean;
  setShowPlayModesDropdown: React.Dispatch<React.SetStateAction<boolean>>;

}

export function LeftSideNavTray({ sfx, playModesRef, styles, handleNavClick, showPlayModesDropdown, setShowPlayModesDropdown, currentHover }: IProps) {
  return <div className="hidden md:flex flex-row flex-nowrap gap-4 md:gap-8 uwd:!gap-24 4k:!gap-30 uwd:py-4 4k:py-10 overflow-visible px-2 w-full items-center">
    <Link
      to="/"
      className={styles.desktopNavLink}
      onClick={(e) => handleNavClick(e, "/")}
    >
      Home
    </Link>

    {/* Play Modes Dropdown */}
    <div className="relative" ref={playModesRef}>
      <button
        className={`${styles.desktopNavLink} flex items-center justify-center gap-2`}
        onClick={() => {
          setShowPlayModesDropdown((p) => !p);
          sfx("transition");
        }}
      >
        Play Modes
        <svg
          className={`w-4 h-4 lg:w-5 lg:h-5 uwd:!w-6 uwd:!h-6 4k:!w-8 4k:!h-8 transition-transform ${
            showPlayModesDropdown ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showPlayModesDropdown && (
        <div
          className={`z-50 absolute left-0 top-full mt-2 w-48 lg:w-64 p-2 border rounded-lg ${globalBackgroundStyleOpaque}`}
        >
          <Link
            to="/quiz"
            className={`block w-full text-left px-4 py-3 text-lg lg:text-xl uwd:!text-2xl 4k:!text-3xl
              hover:bg-blue-500/20 hover:border-l-4 hover:border-blue-400 rounded transition-all duration-150 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/quiz")}
          >
            Quiz
          </Link>
          <Link
            to="/do-you-know-swu"
            className={`block w-full text-left px-4 py-3 text-lg lg:text-xl uwd:!text-2xl 4k:!text-3xl
              hover:bg-blue-500/20 hover:border-l-4 hover:border-blue-400 rounded transition-all duration-150 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/do-you-know-swu")}
          >
            DYKSWU?
          </Link>
          {/* <Link
            to="/puzzles"
            className={`block w-full text-left px-4 py-3 text-lg lg:text-xl uwd:!text-2xl 4k:!text-3xl
              hover:bg-blue-500/20 hover:border-l-4 hover:border-blue-400 rounded transition-all duration-150 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/puzzles")}
          >
            Puzzles
          </Link> */}
        </div>
      )}
    </div>
    <Link
      to="/resources"
      className={styles.desktopNavLink}
      onClick={(e) => handleNavClick(e, "/resources")}
    >
      Resources
    </Link>
    <Link
      to="/about"
      className={styles.desktopNavLink}
      onClick={(e) => handleNavClick(e, "/about")}
    >
      About
    </Link>
  </div>;
}