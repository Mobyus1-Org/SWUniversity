export type BadgeId =
  | "iron_man_quiz_2026"
  | "iron_man_dykswu_2026";

export interface BadgeDefinition {
  id: BadgeId;
  displayName: string;
  description: string;
  img: string;
}

export const BADGES: Record<BadgeId, BadgeDefinition> = {
  iron_man_quiz_2026: {
    id: "iron_man_quiz_2026",
    displayName: "Quiz Iron Man 2026",
    description: "Completed the Iron Man Challenge in Quiz mode",
    img: "/assets/quiz-mode-splash.png",
  },
  iron_man_dykswu_2026: {
    id: "iron_man_dykswu_2026",
    displayName: "Do You Know SWU Iron Man 2026",
    description: "Completed the Iron Man Challenge in Do You Know SWU mode",
    img: "/assets/dykswu-mode-splash.png",
  },
};

export function isBadgeId(value: string): value is BadgeId {
  return value in BADGES;
}

export function getBadgeDescription(badgeId: BadgeId): string {
  return BADGES[badgeId]?.description ?? "Unknown badge";
}
