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
