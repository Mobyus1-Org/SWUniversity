import { UserSettingsLocalStorageKey, type SfxType, type UserSettings } from "../../util/const";
import { updateUserSettings } from "../../util/func";
import { globalBackgroundStyleOpaque, LightsaberColors, setLightsaberColor } from "../../util/style-const";

interface IProps {
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  sfx: (type: SfxType, forcePlay?: boolean) => void;
  settingsModalRef: React.RefObject<HTMLDivElement | null>;
  lightsaberColorRef: React.RefObject<HTMLDivElement | null>;
  showLightsaberColorDropdown: boolean;
  setShowLightsaberColorDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredLightsaberColor: keyof typeof LightsaberColors | null;
  setHoveredLightsaberColor: React.Dispatch<React.SetStateAction<keyof typeof LightsaberColors | null>>;
}

const getRGB = (color: keyof typeof LightsaberColors) => {
    if(color === "none") {
      return "none";
    }
    const colorArray = LightsaberColors[color];
    return `rgb(${colorArray[0]}, ${colorArray[1]}, ${colorArray[2]})`;
  };

export function Settings({ userSettings, setUserSettings, sfx, settingsModalRef, lightsaberColorRef, showLightsaberColorDropdown, setShowLightsaberColorDropdown, hoveredLightsaberColor, setHoveredLightsaberColor }: IProps) {

  return <div
    ref={settingsModalRef}
    role="dialog"
    aria-modal="true"
    className={`z-[100] text-sm md:text-lg uwd:!text-xl 4k:!text-2xl
    ${globalBackgroundStyleOpaque} border p-4 fixed top-20 uwd:!top-28 4k:!top-40 right-32 uwd:right-48 4k:right-80`}
  >
    <div
      onClick={() => {
        const storedSettings: UserSettings = JSON.parse(localStorage.getItem(UserSettingsLocalStorageKey) || '{}');
        if(!storedSettings.soundEnabled) {
          setTimeout(() => {
            //for sound back on
            sfx("transition", true);
          }, 150);
        }
        updateUserSettings(setUserSettings, {
          soundEnabled: !userSettings.soundEnabled,
        });
      }}
      className="flex items-center gap-4 uwd:gap-6 4k:gap-8 cursor-pointer hover:bg-white/10 p-2 rounded transition-colors"
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
          //open lightsaber color menu
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
          className={`z-40 absolute md:right-full md:mr-4 md:-top-3 top-full mt-2 md:mt-0 left-0 md:left-auto w-64 p-4 border rounded-lg ${globalBackgroundStyleOpaque}`}
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
                      //turning lightsaber off
                      sfx("lightsaberoff");
                    } else {
                      //changing lightsaber color
                      sfx("lightsaber1");
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
  </div>;
}
