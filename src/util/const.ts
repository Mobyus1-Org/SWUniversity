export const globalBackgroundStyle = "bg-[rgba(23,35,87,0.8)]";
export const globalBackgroundStyleOpaque = "bg-[rgba(23,35,87,1)]";
export type SWUniversityApp = "quiz" | "dykswu";
export type AppModes = "" | "marathon" | "endless" | "standard" | "padawan" | "knight" | "master";
export type ModeDescriptions = { [key in AppModes]: string };
export type SfxType = "click" | "confirm" | "transition";
export type DYKSWUChoice = "name" | "card-type" | "arena" | "subtitle" | "cost" | "aspects" | "power" | "hp" | "traits" | "trigger-condition" | "play-restriction" | "ability-text" | "rarity" | "art" | "something-else" | "no-change";
export const DYKSWUChoices: DYKSWUChoice[] = ["name", "card-type", "arena", "subtitle", "cost", "aspects", "power", "hp", "traits", "trigger-condition", "play-restriction", "ability-text", "rarity", "art", "something-else", "no-change"];
export interface IPageProps {
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}
export const UserSettingsLocalStorageKey = "swuniversity-user-settings";
export type UserSettings = {
  soundEnabled: boolean,
}