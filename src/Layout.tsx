import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  globalBackgroundStyleNoShadow,
  globalBackgroundStyleOpaque,
  LightsaberColors,
  getLightsaberGlowHover,
} from "./util/style-const";
import { DiscordLink, type UserSettings } from "./util/const";
import { AudioContext, ModalContext, type ModalContextProps } from "./util/context";
import { getSWUDBImageLink } from "./util/func";
import { Modal } from "./components/Shared/Modal";
import { Settings } from "./components/Nav/Settings";
import { RightSideTray } from "./components/Nav/RightSideTray";
import { LeftSideNavTray } from "./components/Nav/LeftSideNavTray";

interface IProps {
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  children: React.ReactNode;
}

function Layout({ userSettings, setUserSettings, children }: IProps) {
  const defaultModalContext: ModalContextProps = {
    showModal: false,
    modalKey: "",
    setShowModal: () => {},
    setModalKey: () => {},
    modalData: {},
    setModalData: () => {},
  };
  const { showModal, modalKey, setShowModal, setModalKey, modalData } = React.useContext(ModalContext) ?? defaultModalContext;
  const { sfx } = React.useContext(AudioContext) ?? { sfx: () => {} };
  const [mobileNav, setMobileNav] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [showLightsaberColorDropdown, setShowLightsaberColorDropdown] = React.useState(false);
  const [hoveredLightsaberColor, setHoveredLightsaberColor] = React.useState<keyof typeof LightsaberColors | null>(null);
  const [showPlayModesDropdown, setShowPlayModesDropdown] = React.useState(false);
  const [showMobilePlayModesDropdown, setShowMobilePlayModesDropdown] = React.useState(false);
  const lightsaberColorRef = React.useRef<HTMLDivElement>(null);
  const settingsModalRef = React.useRef<HTMLDivElement>(null);
  const playModesRef = React.useRef<HTMLDivElement>(null);
  const mobilePlayModesRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close lightsaber color dropdown
      if (lightsaberColorRef.current && !lightsaberColorRef.current.contains(event.target as Node)) {
        setShowLightsaberColorDropdown(false);
      }

      // Close settings modal
      if (settingsModalRef.current && !settingsModalRef.current.contains(event.target as Node) && showModal && modalKey === "settings") {
        setShowModal(false);
        setModalKey("");
      }

      // Close play modes dropdown
      if (playModesRef.current && !playModesRef.current.contains(event.target as Node)) {
        setShowPlayModesDropdown(false);
      }

      // Close mobile play modes dropdown
      if (mobilePlayModesRef.current && !mobilePlayModesRef.current.contains(event.target as Node)) {
        setShowMobilePlayModesDropdown(false);
      }
    };

    if (showLightsaberColorDropdown || (showModal && modalKey === "settings") || showPlayModesDropdown || showMobilePlayModesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLightsaberColorDropdown, showModal, modalKey, setShowModal, setModalKey, showPlayModesDropdown, showMobilePlayModesDropdown]);

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    sfx("transition");
    setMobileNav(false);
    setModalKey("");
    setShowModal(false);
    setShowPlayModesDropdown(false);
    setShowMobilePlayModesDropdown(false);

    const isCurrentPage = location.pathname === path;

    setTimeout(() => {
      if (isCurrentPage) {
        setRefreshKey((prev) => prev + 1);
      } else {
        navigate(path);
      }
    }, 50);
  };

  const MenuButton = () => <label className="btn btn-ghost btn-circle">
    <img src="/assets/menu_icon.png" alt="Menu" className="w-8" />
  </label>;

  const renderModal = () => {
    if (!showModal) return null;

    switch (modalKey) {
      case "settings":
        return <Settings
          userSettings={userSettings}
          setUserSettings={setUserSettings}
          sfx={sfx}
          settingsModalRef={settingsModalRef}
          lightsaberColorRef={lightsaberColorRef}
          showLightsaberColorDropdown={showLightsaberColorDropdown}
          setShowLightsaberColorDropdown={setShowLightsaberColorDropdown}
          hoveredLightsaberColor={hoveredLightsaberColor}
          setHoveredLightsaberColor={setHoveredLightsaberColor}
        />;

      case "relevant-cards":
        return <Modal isOpen={true} onClose={() => setShowModal(false)}>
          <div className="flex flex-wrap justify-center gap-4">
          {
            modalData.currentQuiz && modalData.currentQuiz.relevantCards.map((cardName: string, index: number) => <div
              key={"relevant-card-" + index}
              className="w-fit h-100 lg:h-120 uwd:!h-190 4k:!h-280 m-2.5"
            >
              <img
                src={getSWUDBImageLink(cardName)}
                alt={`card ${cardName}`}
                className="max-h-full object-contain"
              />
            </div>)
          }
          </div>
        </Modal>;

      default:
        return null;
    }
  };

  const currentHover = getLightsaberGlowHover(userSettings.lightsaberColor);

  const styles = {
    desktopNavLink: `btn btn-ghost text-md lg:text-2xl uwd:!text-4xl 4k:!text-7xl
      border-gray-400 bg-blue-500/20 rounded mx-4 4k:mx-7 py-5 uwd:py-8 4k:py-15 4k:px-8 ${currentHover}`,
    mobileNavLink: `btn btn-ghost w-full text-md lg:text-2xl uwd:!text-4xl 4k:!text-7xl
      border-gray-400 bg-blue-500/20 rounded mx-auto 4k:mx-7 py-5 uwd:py-8 4k:py-15 4k:px-8 ${currentHover}`,
  }

  return <div className="layout">
    <div
      className={`relative navbar z-50 border-b ${globalBackgroundStyleNoShadow}`}
    >
      <div className="flex justify-between items-center w-full px-4">
          {/* Left side links */}
          <div
            className="md:hidden"
            onClick={() => setMobileNav((p) => !p)}
          >
            <MenuButton />
          </div>
          <LeftSideNavTray sfx={sfx} playModesRef={playModesRef} styles={styles} handleNavClick={handleNavClick} showPlayModesDropdown={showPlayModesDropdown} setShowPlayModesDropdown={setShowPlayModesDropdown} currentHover={currentHover} />
          <RightSideTray setShowModal={setShowModal} setModalKey={setModalKey} sfx={sfx} />
        </div>
      </div>
    <main>
      <div className="relative p-4 z-10 min-h-[75vh]">
        <div key={refreshKey}>
          {children}
        </div>
      </div>
    </main>
    {modalKey !== "relevant-cards" && (
      <footer className="text-center text-sm uwd:text-lg 4k:text-2xl mt-8 border-t pt-4 space-y-2 text-gray-400 z-10 relative">
        <p className="p-2">
          For educational purposes only. Check out our <a
            href={DiscordLink}
            className="text-blue-500 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord server here
          </a>
          !
        </p>
        <p className="p-2">
          SWUniversity is in no way affiliated with Disney or Fantasy Flight
          Games. Star Wars characters, cards, logos, and art are property of
          Disney and/or Fantasy Flight Games.
        </p>
      </footer>
    )}
    {/* Render modals via function */}
    {renderModal()}
    {mobileNav && (
      <div
        className={`fixed top-0 left-0 z-20 h-1/2 w-1/2 md:w-1/4 z-20 border-r border-b p-4 ${globalBackgroundStyleOpaque}`}
      >
        <div
          className="w-1/4 mx-auto mb-8"
          onClick={() => {
            setMobileNav(false);
            setModalKey("");
          }}
        >
          <MenuButton />
        </div>
        <div className="flex flex-col gap-6 p-4 overflow-visible">
          <Link
            to="/"
            className={styles.mobileNavLink}
            onClick={(e) => handleNavClick(e, "/")}
          >
            Home
          </Link>

          {/* Play Modes Dropdown */}
          <div className="relative" ref={mobilePlayModesRef}>
            <button
              className={`${styles.mobileNavLink} flex items-center justify-center gap-2`}
              onClick={() => {
                setShowMobilePlayModesDropdown((p) => !p);
                sfx("transition");
              }}
            >
              Play Modes
              <svg
                className={`w-4 h-4 lg:w-5 lg:h-5 transition-transform ${
                  showMobilePlayModesDropdown ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMobilePlayModesDropdown && (
              <div
                className={`z-50 absolute left-full top-0 ml-2 w-64 p-2 border rounded-lg ${globalBackgroundStyleOpaque}`}
              >
                <Link
                  to="/quiz"
                  className={`block w-full text-left px-4 py-3 text-xl lg:text-2xl
                    hover:bg-blue-500/20 hover:border-l-4 hover:border-blue-400 rounded transition-all duration-150 ${currentHover}`}
                  onClick={(e) => handleNavClick(e, "/quiz")}
                >
                  Quiz
                </Link>
                <Link
                  to="/do-you-know-swu"
                  className={`block w-full text-left px-4 py-3 text-xl lg:text-2xl
                    hover:bg-blue-500/20 hover:border-l-4 hover:border-blue-400 rounded transition-all duration-150 ${currentHover}`}
                  onClick={(e) => handleNavClick(e, "/do-you-know-swu")}
                >
                  DYKSWU?
                </Link>
              </div>
            )}
          </div>

          {/* <Link to="/puzzles" className="btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl">Puzzles</Link> */}
          <Link
            to="/resources"
            className={`${styles.mobileNavLink} flex items-center justify-center gap-2`}
            onClick={(e) => handleNavClick(e, "/resources")}
          >
            Resources
          </Link>
          <Link
            to="/about"
            className={`${styles.mobileNavLink} flex items-center justify-center gap-2`}
            onClick={(e) => handleNavClick(e, "/about")}
          >
            About
          </Link>
        </div>
      </div>
    )}
    {/* Render modals via function */}
    {renderModal()}
  </div>
}

export default Layout;
