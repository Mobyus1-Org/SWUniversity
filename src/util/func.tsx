import type { QuizModes } from "./const";

export type Quiz = {
  id: number;
  question: string;
  choices: {
    [key: string]: string
  };
  answer: string;
  relevantCards: string[];
  relevantRule: string;
  tags: string[];
  difficulty: number;
}

export type UserResponse = {
  quizId: number;
  selected: string;
  correct: string;
}

const notBeforeId = 1;
const excludedIds: number[] = [

];

export async function getQuizDataAsync() : Promise<Quiz[]> {
  const response = await fetch('/quiz-database.json');
  const data = await response.json();

  return data.filter((quiz: Quiz) => quiz.id >= notBeforeId && !excludedIds.includes(quiz.id));
}

export function isMarathonVariant(mode: QuizModes): boolean {
  return mode === "marathon" || mode === "padawan" || mode === "knight" || mode === "master";
}

export function renderItalicsAndBold(text: string): React.JSX.Element {
  const lines = text.split('\n');
  const highlightWords = [
    "Shielded",
    "Sentinel",
    "Saboteur",
    "Raid",
    "Restore",
    "Ambush",
    "Grit",
    "Overwhelm",
    "Smuggle",
    "Bounty",
    "Bounties",
    "Coordinate",
    "Exploit",
    "Piloting",
    "Hidden",
    "Plot",
  ];

  const processText = (text: string): React.JSX.Element => {
    if (highlightWords.includes(text)) {
      return <span className="text-red-400">{text}</span>;
    }
    return <>{text}</>;
  };

  return <>{lines.map((line, index) => {
    const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g); //split by **text** or _text_
    return <span key={index}>
      {parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const innerText = part.slice(2, -2);
          //check if innerText has _text_ within it
          const innerParts = innerText.split(/(_.*?_)/g);
          return <strong key={partIndex}>
            {innerParts.map((innerPart, innerPartIndex) => {
              if (innerPart.startsWith('_') && innerPart.endsWith('_')) {
                const emphText = innerPart.slice(1, -1);
                return <em key={innerPartIndex}>{processText(emphText)}</em>;
              } else {
                return processText(innerPart);
              }
            })}
          </strong>;
        } else if (part.startsWith('_') && part.endsWith('_')) {
          const emphText = part.slice(1, -1);
          return <em key={partIndex}>{processText(emphText)}</em>;
        } else {
          return processText(part);
        }
      })}
      <br />
    </span>;
  })}</>;
}
