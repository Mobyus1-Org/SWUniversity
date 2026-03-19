import React from "react";
import Link from "next/link";

import { DiscordLink, type SfxType } from "@/util/const";
import type { ModalKey } from "@/util/context";

interface IProps {
  authState: "loading" | "authed" | "anon";
  onLogout: () => Promise<void>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setModalKey: React.Dispatch<React.SetStateAction<ModalKey>>;
  sfx: (type: SfxType, forcePlay?: boolean) => void;
  settingsButtonRef: React.RefObject<HTMLDivElement>;
}

export function RightSideTray({ authState, onLogout, setShowModal, setModalKey, sfx, settingsButtonRef }: IProps) {
  return <div className="flex items-center justify-center gap-4 shrink-0 uwd:!gap-6 4k:!gap-8">
    {authState !== "loading" && authState === "anon" && (
      <div
        className="hidden xl:flex items-center gap-3 lg:gap-4 shrink-0 uwd:!gap-4 4k:!gap-6 whitespace-nowrap
          bg-[rgba(255,255,255,0.25)] rounded-full h-11 lg:h-14 uwd:!h-20 4k:!h-32
          px-6 lg:px-9 uwd:!px-10 4k:!px-12"
      >
        <Link href="/login" className="underline text-sm lg:text-lg uwd:!text-2xl 4k:!text-4xl whitespace-nowrap">Login</Link>
        <span>/</span>
        <Link href="/signup" className="underline text-sm lg:text-lg uwd:!text-2xl 4k:!text-4xl whitespace-nowrap">Sign Up</Link>
      </div>
    )}

    {authState !== "loading" && authState === "authed" && (
      <div
        className="hidden xl:flex items-center gap-3 lg:gap-4 shrink-0 uwd:!gap-4 4k:!gap-6 whitespace-nowrap
          bg-[rgba(255,255,255,0.25)] rounded-full h-11 lg:h-14 uwd:!h-20 4k:!h-32
          px-6 lg:px-9 uwd:!px-10 4k:!px-12"
      >
        <Link href="/profile" className="underline text-sm lg:text-lg uwd:!text-2xl 4k:!text-4xl whitespace-nowrap">Profile</Link>
        <button type="button" onClick={() => void onLogout()} className="underline text-sm lg:text-lg uwd:!text-2xl 4k:!text-4xl whitespace-nowrap">
          Logout
        </button>
      </div>
    )}

    <div
      className="flex items-center gap-2 shrink-0 uwd:!gap-4 4k:!gap-6
        bg-[rgba(255,255,255,0.25)] rounded-full h-11 lg:h-14 uwd:!h-20 4k:!h-32 px-3 lg:px-5 uwd:!px-7 4k:!px-10"
    >
      <div
      ref={settingsButtonRef}
      className="flex items-center justify-center text-md md:text-xl uwd:!text-2xl 4k:!text-3xl btn btn-ghost min-h-0 h-9 lg:h-12 uwd:!h-16 4k:!h-24 min-w-0 p-2 lg:p-2.5 uwd:!p-3.5 4k:!p-5"
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
      <img src="/assets/divider.png" alt="divider" className="h-8 lg:h-10 uwd:!h-12 4k:!h-16" />
      <div className="flex items-center justify-center gap-3 lg:gap-4 uwd:!gap-6 4k:!gap-8 px-1.5 lg:px-2.5 uwd:!px-3.5 4k:!px-5">
      <a
        href={DiscordLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join our Discord"
        className="flex items-center justify-center shrink-0"
      >
        <img
        src="/assets/Discord-logo2.png"
        alt="Discord"
        className="w-10 lg:w-12 uwd:!w-16 4k:!w-20"
        />
      </a>
      <a
        href="https://www.patreon.com/mobyus1"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Support us on Patreon"
        className="flex items-center justify-center shrink-0"
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