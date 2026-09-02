import { UserSettingsLocalStorageKey, type AppModes, type SWUniversityApp, type UserSettings } from "@/util/const";
import { isMockCardId } from "@/server/engine/card-db/card-mocks";

export type AppModeSetEntry = {
  id: number;
}

export type Quiz = AppModeSetEntry & {
  question: string;
  answer: string;
  difficulty: number;
  choices: {
    [key: string]: string
  };
  relevantCards: string[];
  relevantRule: string;
  tags: string[];
}

export type UserResponse = {
  modeId: number;
  variant?: number;
  selected: string;
  correct: string;
  followUp?: {
    followUpSelected: string;
    followUpCorrect: string;
  }
}

const notBeforeQuizId = 1;
const excludedQuizIds: number[] = [

];

export async function getQuizDataAsync() : Promise<Quiz[]> {
  const response = await fetch('/quiz-database.json');
  const data = await response.json();

  return data.filter((quiz: Quiz) => quiz.id && quiz.id >= notBeforeQuizId && !excludedQuizIds.includes(quiz.id));
}

export type DoYouKnowSWUVariant = {
  img: string;
  answer: string;
  difficulty: number;
  followUp?: {
    question: string;
    choices: {
      [key: string]: string
    };
    answer: string;
  };
  explanation: string;
}

export type DoYouKnowSWUQuestion = AppModeSetEntry & {
  actualCard: string;
  variants: DoYouKnowSWUVariant[];
}

const notBeforeDYKSWUId = 1;
const excludedDYKSWUIds: number[] = [

];

export async function getDoYouKnowSWUDataAsync() : Promise<DoYouKnowSWUQuestion[]> {
  const response = await fetch('/dykswu-database.json');
  const data = await response.json();

  return data.filter((question: DoYouKnowSWUQuestion) => question.id && question.id >= notBeforeDYKSWUId && !excludedDYKSWUIds.includes(question.id));
}

export function renderDYKSWUChoiceTitle(choice: string) {
  return choice === "hp" ? "HP" : choice.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const setsMap = {
  "SOR": 30,
  "SHD": 26,
  "TWI": 30,
  "JTL": 30,
  "LOF": 30,
  "SEC": 26,
};

export function isHorizontalCard(cardName: string): boolean {
  const parts = cardName.split("_");
  if (parts.length < 2) throw new Error(`Invalid card name format: ${cardName}`);
  const setCode = parts[0];
  if (!(setCode in setsMap)) return false;//unknown set or tokens or special set, assume vertical
  const setNumber = parts[1];
  if(setNumber.startsWith("T")) return false;//tokens are vertical
  if(parts.length > 2) return false;//_BACK cards are vertical
  const setNum = parseInt(setNumber, 10);
  if (isNaN(setNum)) throw new Error(`Invalid card number: ${setNumber}`);

  return setNum <= setsMap[setCode as keyof typeof setsMap];
}

/**
 * Card art path. Mocked (previewed, unreleased) cards live under a `mock_` filename prefix so that
 * official art can land beside them on release day without the generator skipping it — see
 * docs/superpowers/specs/2026-08-11-card-mock-framework-design.md §3.
 */
export function getCardImageLink(cardPattern: string): string {
  return `/assets/cards/full/${artFileStem(cardPattern)}.webp`;
}

export function getCardSquareImageLink(cardPattern: string): string {
  return `/assets/cards/square/${artFileStem(cardPattern)}.webp`;
}

function artFileStem(cardPattern: string): string {
  // A leader's deployed side is requested as `<id>_BACK`, but the mock registry is keyed by BARE
  // card ids — so the suffix has to come off for the lookup and go back on for the filename.
  // Without this a mocked leader's unit-side art lost its `mock_` prefix and fell through the
  // whole fallback chain to the generic card back.
  const BACK = "_BACK";
  const baseId = cardPattern.endsWith(BACK) ? cardPattern.slice(0, -BACK.length) : cardPattern;
  return isMockCardId(baseId) ? `mock_${cardPattern}` : cardPattern;
}

export function getSWUDBImageLink(cardPattern: string): string {
  return `/assets/swudb-import/${cardPattern}.webp`;
}

export function getSWUDBImageLinkFallback(cardPattern: string): string {
  // Fallback to SWUDB CDN — convert SET_NNN back to SET/NNN for the CDN path
  const cdnPattern = cardPattern.replace('_', '/');
  return `https://swudb.com/cdn-cgi/image/quality=10/images/cards/${cdnPattern}.png`;
}

export function getDYKSWUImageLink(fileName: string): string {
  // Try WEBP first, will fallback to PNG if not found
  return `/assets/dykswu/${fileName}.webp`;
}

export function getDYKSWUImageLinkFallback(fileName: string): string {
  // Fallback to PNG (uploaded by data team)
  return `/assets/dykswu/${fileName}.png`;
}

// export function isMarathonVariant(mode: AppModes): boolean {
//   return mode === "marathon" || mode === "padawan" || mode === "knight" || mode === "master";
// }

export function isDifficultyMode(mode: AppModes): boolean {
  return mode === "padawan" || mode === "knight" || mode === "master";
}

export function getModeTitle(app: SWUniversityApp, mode: AppModes): string {
  switch (mode) {
    case "iron-man":
      return "Iron Man Challenge";
    case "endless":
      return "Endless Mode";
    case "standard":
      return "Standard Mode";
    case "padawan":
      return "Padawan Mode";
    case "knight":
      return "Jedi Knight Mode";
    case "master":
      return "Jedi Master Mode";
    case "":
      switch (app) {
        case "quiz":
          return "";
        case "dykswu":
          return "";
        default:
          return "";
      }
    default:
      return "";
  }
}

/**
 * Formats ONE line of markup: `%{attention}` (bold + red), `**bold**`, `_italic_`, nested
 * `**_both_**`, plus the pattern-driven treatments — `+X/+Y` buffs split red/blue, and aspect names
 * as icons.
 *
 * Colour is explicit. There is deliberately no list of keyword names to auto-redden: such a list
 * goes stale every set and cannot tell the keyword "Plot" from the English word. Authors write
 * `%{Sentinel}` when they want the emphasis.
 *
 * Deliberately knows nothing about newlines. `renderItalicsAndBold` handles those for Quiz/DYKSWU,
 * while puzzle text leaves them to a `whitespace-pre-wrap` container — feeding one fragment at a
 * time is what lets both callers share this without one of them getting stray <br/>s.
 */
export function renderInlineMarkup(line: string, keyPrefix: string | number = 0): React.JSX.Element {

  const buffPattern = new RegExp('[+-]\\d+\\/[+-]\\d+', 'g');

  const processBuffText = (text: string): React.JSX.Element => {
    const parts = text.split('/');
    if (parts.length === 2) {
      return <span>
        <span className="text-red-300">{parts[0]}</span>
        <span>/</span>
        <span className="text-blue-300">{parts[1]}</span>
      </span>;
    }
    return <>{text}</>;
  };

  const processText = (text: string, key: number): React.JSX.Element => {
    const parts = text.split(' ');
    if (parts.length > 1 && parts.some(part => buffPattern.test(part))) {
      return <>
      {
        parts.map((part, index) => <span key={"proc-text-" + index}>
          {processBuffText(part)}
          {index < parts.length - 1 ? ' ' : ''}
        </span>)
      }
      </>;
    } else if (buffPattern.test(text)) {
      return processBuffText(text);
    }
    return <span key={"proc-text-" + key}>{text}</span>;
  };

  // %{...} is listed first so it wins over the ** and _ alternatives. Its content is [^}]+ rather
  // than a lazy .*? so it can never run past a closing brace, and the + means `%{}` is not a token
  // at all — an empty attention run would be invisible anyway, so it stays literal.
  const parts = line.split(/(%\{[^}]+\}|\*\*.*?\*\*|_.*?_)/g); //split by %{text}, **text** or _text_
  return <span key={"line-" + keyPrefix}>
    {
      parts.map((part, partIndex) => {
        // Mirrors the split pattern exactly — a bare "%{}" satisfies startsWith/endsWith but was
        // never captured as a token, so it has to stay literal text.
        if (/^%\{[^}]+\}$/.test(part)) {
          // The author's explicit "look at this" — bold and red, whatever the text is.
          return <strong key={"part-" + partIndex} className="text-red-400">{part.slice(2, -1)}</strong>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          const innerText = part.slice(2, -2);
          //check if innerText has _text_ within it
          const innerParts = innerText.split(/(_.*?_)/g);
          return <strong key={"part-" + partIndex}>
          {
            innerParts.map((innerPart, innerPartIndex) => {
              if (innerPart.startsWith('_') && innerPart.endsWith('_')) {
                const emphText = innerPart.slice(1, -1);
                return <em key={"inner-part-" + innerPartIndex}>{processText(emphText, innerPartIndex)}</em>;
              } else {
                return processText(innerPart, innerPartIndex);
              }
            })
          }
          </strong>;
        } else if (part.startsWith('_') && part.endsWith('_')) {
          const emphText = part.slice(1, -1);
          const aspects = ["Heroism", "Villainy", "Command", "Aggression", "Vigilance", "Cunning"];
          if (aspects.includes(emphText)) {
            const iconMap: { [key: string]: string } = {
              "Heroism": "/assets/SWH_Aspects_Heroism.png",
              "Villainy": "/assets/SWH_Aspects_Villainy.png",
              "Command": "/assets/SWH_Aspects_Command.png",
              "Aggression": "/assets/SWH_Aspects_Aggression.png",
              "Vigilance": "/assets/SWH_Aspects_Vigilance.png",
              "Cunning": "/assets/SWH_Aspects_Cunning.png",
            };
            return <img key={"part-" + partIndex} src={iconMap[emphText]} alt={emphText} className="inline h-8 w-8 mx-1" />;
          }
          return <em key={"part-" + partIndex}>{processText(emphText, partIndex)}</em>;
        } else {
          return processText(part, partIndex);
        }
      })
    }
    </span>;
}

/**
 * Quiz/DYKSWU text: every line formatted by {@link renderInlineMarkup}, each followed by a <br/>.
 * The line handling lives here rather than in the formatter so puzzle text — which relies on
 * `whitespace-pre-wrap` instead — can share the formatter without inheriting these breaks.
 */
export function renderItalicsAndBold(text: string): React.JSX.Element {
  const lines = text.split('\n');
  return <>{lines.map((line, index) => (
    <span key={"line-wrap-" + index}>
      {renderInlineMarkup(line, index)}
      <br />
    </span>
  ))}</>;
}

export function preloadImagesAsync(urls: string[]): Promise<void> {
  const promises = urls.map((url) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      // On error, try to load anyway - browser will handle fallback via onError handlers
      img.onerror = () => resolve(); // Changed from reject to resolve
    });
  });

  return Promise.allSettled(promises).then(() => undefined);
}

export function preloadCardImagesAsync(cardPatterns: string[]): Promise<void> {
  const urls = cardPatterns.map(pattern => getCardImageLink(pattern));
  return preloadImagesAsync(urls);
}

export function preloadSWUDBImagesAsync(cardPatterns: string[]): Promise<void> {
  const urls = cardPatterns.map(pattern => getSWUDBImageLink(pattern));
  return preloadImagesAsync(urls);
}

export function preloadDYKSWUImagesAsync(fileNames: string[]): Promise<void> {
  const urls = fileNames.map(fileName => getDYKSWUImageLink(fileName));
  return preloadImagesAsync(urls);
}

export function updateUserSettings(setter: React.Dispatch<React.SetStateAction<UserSettings>>, newSettings: Partial<UserSettings>) {
  setter((prevSettings) => {
    const updated = {
      ...prevSettings,
      ...newSettings
    };
    localStorage.setItem(UserSettingsLocalStorageKey, JSON.stringify(updated));
    return updated;
  });
}
