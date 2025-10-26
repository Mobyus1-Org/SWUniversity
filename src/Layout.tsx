import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  globalBackgroundStyleNoShadow,
  globalBackgroundStyleOpaque,
  LightsaberColors,
  getLightsaberGlowHover,
  setLightsaberColor,
} from "./util/style-const";
import { UserSettingsLocalStorageKey, type UserSettings } from "./util/const";
import { AudioContext, ModalContext, type ModalContextProps } from "./util/context";
import { getSWUDBImageLink, updateUserSettings } from "./util/func";
import { Modal } from "./components/Shared/Modal";

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
  const lightsaberColorRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close lightsaber color dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lightsaberColorRef.current && !lightsaberColorRef.current.contains(event.target as Node)) {
        setShowLightsaberColorDropdown(false);
      }
    };

    if (showLightsaberColorDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLightsaberColorDropdown]);

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    sfx("transition");
    setMobileNav(false);
    setModalKey("");
    setShowModal(false);

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

  const getRGB = (color: keyof typeof LightsaberColors) => {
    if(color === "none") {
      return "none";
    }
    const colorArray = LightsaberColors[color];
    return `rgb(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]})`;
  };

  const renderModal = () => {
    if (!showModal) return null;

    switch (modalKey) {
      case "settings":
        return <div
          role="dialog"
          aria-modal="true"
          className={`z-25 text-sm md:text-lg uwd:!text-xl 4k:!text-2xl
          ${globalBackgroundStyleOpaque} border p-4 fixed top-20 uwd:!top-28 4k:!top-40 right-32 uwd:right-48 4k:right-80`}
        >
          <div
            onClick={() => {
              const storedSettings: UserSettings = JSON.parse(localStorage.getItem(UserSettingsLocalStorageKey) || '{}');
              if(!storedSettings.soundEnabled) {
                setTimeout(() => {
                  sfx("transition", true);
                }, 150);
              }
              updateUserSettings(setUserSettings, {
                soundEnabled: !userSettings.soundEnabled,
              });
            }}
            className="flex items-center gap-4 uwd:gap-6 4k:gap-8 cursor-pointer"
          >
            {userSettings.soundEnabled ? (
              <img
                src="/assets/speaker1.png"
                alt="Sound On"
                className="w-6 lg:w-8 uwd:!w-11 4k:!w-15"
              />
            ) : (
              <img
                src="/assets/speaker2.png"
                alt="Sound Off"
                className="w-6 lg:w-8 uwd:!w-11 4k:!w-15"
              />
            )}
            <label className="cursor-pointer">Enable Sound Effects</label>
          </div>
          <div className="mt-4 relative" ref={lightsaberColorRef}>
            <div
              className="flex items-center gap-4 uwd:gap-6 4k:gap-8 mb-2 cursor-pointer hover:bg-white/10 p-2 rounded"
              onClick={() => {
                setShowLightsaberColorDropdown((p) => !p);
                sfx("transition");
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" className="lg:w-8 uwd:!w-11 4k:!w-15">
                <rect x="14" y="22" width="4" height="8" fill="#888888" />
                <rect
                  x="14"
                  y="2"
                  width="4"
                  height="20"
                  fill={getRGB(hoveredLightsaberColor || userSettings.lightsaberColor)}
                  filter="drop-shadow(0 0 4px currentColor)"
                />
              </svg>
              <label className="text-lg lg:text-xl uwd:text-2xl 4k:text-4xl cursor-pointer">Lightsaber Color</label>
            </div>
            {/* Lightsaber Color Dropdown */}
            {showLightsaberColorDropdown && (
              <div
                className={`z-40 absolute right-full mr-4 -top-3 w-64 p-4 border rounded-lg ${globalBackgroundStyleOpaque}`}
                onMouseLeave={() => setHoveredLightsaberColor(null)}
              >
                <div className="space-y-1">
                  {Object.keys(LightsaberColors).map((colorKey) => {
                    const isSelected = colorKey === userSettings.lightsaberColor;
                    return (
                      <div
                        key={colorKey}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white/10 transition-colors ${
                          isSelected ? 'bg-white/20' : ''
                        }`}
                        onMouseEnter={() => setHoveredLightsaberColor(colorKey as keyof typeof LightsaberColors)}
                        onClick={() => {
                          const newColor = colorKey as keyof typeof LightsaberColors;
                          updateUserSettings(setUserSettings, { lightsaberColor: newColor });
                          setLightsaberColor(newColor);
                          if(newColor === "none") {
                            sfx("confirm");
                          } else {
                            sfx("transition");
                          }
                          setHoveredLightsaberColor(null);
                          setShowLightsaberColorDropdown(false);
                        }}
                      >
                        <div className="w-4 h-4 rounded-full border border-gray-400" style={{
                          backgroundColor: colorKey === 'none' ? 'transparent' : getRGB(colorKey as keyof typeof LightsaberColors),
                          boxShadow: colorKey === 'none' ? 'none' : `0 0 8px ${getRGB(colorKey as keyof typeof LightsaberColors)}`
                        }}>
                        </div>
                        <span className="text-sm lg:text-base uwd:text-lg 4k:text-2xl">
                          {colorKey === 'none'
                            ? 'Turn Off'
                            : colorKey.charAt(0).toUpperCase() + colorKey.slice(1).replace(/([A-Z])/g, ' $1')}
                        </span>
                        {isSelected && (
                          <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="mt-8">
            <Link
              to="/about"
              className="btn btn-outline w-full text-lg lg:text-xl uwd:!text-2xl 4k:!text-4xl"
              onClick={(e) => handleNavClick(e, "/about")}
            >
              Go to About Page
            </Link>
          </div>
        </div>;

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

  return <div className="layout">
    <main>
      <div
        className={`relative navbar z-10 border-b ${globalBackgroundStyleNoShadow}`}
      >
        <div className="flex justify-between items-center w-full px-4">
          {/* Left side links */}
          <div
            className="md:hidden"
            onClick={() => setMobileNav((p) => !p)}
          >
            <MenuButton />
          </div>
          <div className="hidden md:block flex gap-4 md:gap-8 uwd:!gap-24 4k:!gap-30 uwd:py-4 4k:py-10 overflow-visible px-2">
            <Link
              to="/"
              className={`btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl
                border-gray-400 bg-blue-500/20 rounded mx-4 4k:mx-7 py-5 uwd:py-8 4k:py-15 4k:px-8 ${currentHover}`}
              onClick={(e) => handleNavClick(e, "/")}
            >
              Home
            </Link>
            <Link
              to="/quiz"
              className={`btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl
                border-gray-400 bg-blue-500/20 rounded mx-4 4k:mx-7 py-5 uwd:py-8 4k:py-15 4k:px-8 ${currentHover}`}
              onClick={(e) => handleNavClick(e, "/quiz")}
            >
              Quiz
            </Link>
            <Link
              to="/do-you-know-swu"
              className={`btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl
                border-gray-400 bg-blue-500/20 rounded mx-6 py-5 uwd:py-8 4k:py-15 4k:px-8 ${currentHover}`}
              onClick={(e) => handleNavClick(e, "/do-you-know-swu")}
            >
              DYKSWU?
            </Link>
            {/* <Link to="/puzzles" className="btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl">Puzzles</Link> */}
          </div>
          {/* Right side tray */}
            <div className="flex items-center justify-center gap-4 uwd:!gap-6 4k:!gap-8">
              <div
                className="flex items-center gap-2 uwd:!gap-4 4k:!gap-6
                  bg-[rgba(255,255,255,0.25)] rounded-full px-4 py-2 uwd:!px-6 4k:!px-8 4k:!py-3"
              >
                <div
                className="flex items-center justify-center text-md md:text-xl uwd:!text-2xl 4k:!text-3xl btn btn-ghost p-2 uwd:!p-3 4k:!p-4"
                onClick={() => {
                  setShowModal((p) => !p);
                  setModalKey("settings");
                  sfx("transition")
                }}
                >
                <img
                  src="/assets/GearIcon.png"
                  alt="Settings"
                  className="w-8 lg:w-10 uwd:!w-12 4k:!w-16"
                />
                </div>
                <img src="/assets/divider.png" alt="divider" className="h-8 uwd:!h-10 4k:!h-16" />
                <div className="flex items-center justify-center gap-4 uwd:!gap-6 4k:!gap-8 px-2 uwd:!px-3 4k:!px-4">
                <a
                  href="https://discord.gg/dbQXnVkjFV"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join our Discord"
                  className="flex items-center justify-center"
                >
                  <img
                  src="/assets/Discord-logo2.png"
                  alt="Discord"
                  className="w-11 lg:w-14 uwd:!w-16 4k:!w-22"
                  />
                </a>
                <a
                  href="https://www.patreon.com/mobyus1"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Support us on Patreon"
                  className="flex items-center justify-center"
                >
                  <img
                  src="/assets/PatreonIcon.png"
                  alt="Patreon"
                  className="w-8 lg:w-10 uwd:!w-12 4k:!w-16"
                  />
                </a>
                </div>
              </div>
            </div>
        </div>
      </div>
      <div className="relative p-4 z-10 min-h-[75vh]">
        <div key={refreshKey}>{children}</div>
      </div>
    </main>
    {modalKey !== "relevant-cards" && (
      <footer className="text-center text-sm uwd:text-lg 4k:text-2xl mt-8 border-t pt-4 space-y-2 text-gray-400 z-10 relative">
        <p className="p-2">
          For educational purposes only. Check out our{" "}
          <a
            href="https://discord.gg/dbQXnVkjFV"
            className="text-blue-500 underline"
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
            className={`btn btn-outline text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl w-full
              border-gray-400 bg-blue-500/20 rounded py-5 mx-2 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/")}
          >
            Home
          </Link>
          <Link
            to="/quiz"
            className={`btn btn-outline text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl w-full
              border-gray-400 bg-blue-500/20 rounded py-5 mx-2 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/quiz")}
          >
            Quiz
          </Link>
          <Link
            to="/do-you-know-swu"
            className={`btn btn-outline text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl flex-col w-full
              border-gray-400 bg-blue-500/20 rounded py-5 mx-2 ${currentHover}`}
            onClick={(e) => handleNavClick(e, "/do-you-know-swu")}
          >
            DYKSWU?
          </Link>
          {/* <Link to="/puzzles" className="btn btn-ghost text-xl lg:text-3xl uwd:!text-4xl 4k:!text-7xl">Puzzles</Link> */}
        </div>
      </div>
    )}
  </div>;
}

export default Layout;
