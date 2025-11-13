import { DiscordLink, type SfxType } from "../../util/const";
import type { ModalKey } from "../../util/context";

interface IProps {
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setModalKey: React.Dispatch<React.SetStateAction<ModalKey>>;
  sfx: (type: SfxType, forcePlay?: boolean) => void;
  settingsButtonRef: React.RefObject<HTMLDivElement | null>;
}

export function RightSideTray({ setShowModal, setModalKey, sfx, settingsButtonRef }: IProps) {
  return <div className="flex items-center justify-center gap-4 uwd:!gap-6 4k:!gap-8">
    <div
      className="flex items-center gap-2 uwd:!gap-4 4k:!gap-6
        bg-[rgba(255,255,255,0.25)] rounded-full px-4 py-2 uwd:!px-6 4k:!px-8 4k:!py-3"
    >
      <div
      ref={settingsButtonRef}
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
        href={DiscordLink}
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
  </div>;
}