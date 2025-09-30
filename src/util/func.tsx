import { UserSettingsLocalStorageKey, type AppModes, type SWUniversityApp, type UserSettings } from "./const";

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
  const parts = cardName.split("/");
  if (parts.length !== 2) throw new Error(`Invalid card name format: ${cardName}`);
  const setCode = parts[0];
  if (!(setCode in setsMap)) return false;//unknown set or tokens or special set, assume vertical
  const setNumber = parts[1];
  if(setNumber.startsWith("T")) return false;//tokens are vertical
  if(setNumber.includes("-")) return false;//-back or -portrait cards are vertical
  const setNum = parseInt(setNumber, 10);
  if (isNaN(setNum)) throw new Error(`Invalid card number: ${setNumber}`);

  return setNum <= setsMap[setCode as keyof typeof setsMap];
}

export function getSWUDBImageLink(cardPattern: string): string {
  const parts = cardPattern.split('/');
  if (parts.length !== 2) throw new Error(`Invalid card name format: ${cardPattern}`);

  return `https://swudb.com/cdn-cgi/image/quality=40/images/cards/${cardPattern}.png`;
}

export function getDYKSWUImageLink(fileName: string): string {
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
    case "marathon":
      return "Marathon Mode";
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

export function renderItalicsAndBold(text: string): React.JSX.Element {
  const lines = text.split('\n');
  const highlightWords = [
    "Shielded",
    "Sentinel",
    "Saboteur",
    "Raid", "Raid 1", "Raid 2", "Raid 3", "Raid 4", "Raid 5", "Raid 6", "Raid 7", "Raid 8", "Raid 9", "Raid 10",
    "Restore", "Restore 1", "Restore 2", "Restore 3", "Restore 4", "Restore 5", "Restore 6", "Restore 7", "Restore 8", "Restore 9", "Restore 10",
    "Ambush",
    "Grit",
    "Overwhelm",
    "Smuggle",
    "Bounty",
    "Bounties",
    "Coordinate",
    "Exploit", "Exploit 1", "Exploit 2", "Exploit 3", "Exploit 4", "Exploit 5", "Exploit 6", "Exploit 7", "Exploit 8", "Exploit 9", "Exploit 10",
    "Piloting",
    "Hidden",
    "Plot",
  ];

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
    if (highlightWords.includes(text)) {
      return <span key={"highlight-word-" + key} className="text-red-400">{text}</span>;
    }
    return <span key={"proc-text-" + key}>{text}</span>;
  };

  return <>{lines.map((line, index) => {
    const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g); //split by **text** or _text_
    return <span key={"line-" + index}>
    {
      parts.map((part, partIndex) => {
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
            return <img key={"part-" + partIndex} src={iconMap[emphText]} alt={emphText} className="inline h-8 uwd:h-14 4k:h-20 w-8 uwd:w-14 4k:w-20 mx-1" />;
          }
          return <em key={"part-" + partIndex}>{processText(emphText, partIndex)}</em>;
        } else {
          return processText(part, partIndex);
        }
      })
    }
    <br />
    </span>;
  })}</>;
}

export function preloadImagesAsync(urls: string[]): Promise<void> {
  const promises = urls.map((url) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = () => reject();
    });
  });

  return Promise.allSettled(promises).then(() => undefined);
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
