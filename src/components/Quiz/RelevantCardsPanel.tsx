import type { Quiz } from "../../util/func";

interface IProps {
  currentQuiz: Quiz;
  setShowModal: (show: boolean) => void;
}

export function RelevantCardsPanel({ currentQuiz, setShowModal }: IProps) {
  const scale = getScaleForCards(currentQuiz.relevantCards.length);

  return <div className="flex-1 flex flex-[0_0_50%] flex-wrap items-center justify-center">
  {
    currentQuiz.relevantCards.length > 0
    ? <div>
      <div className="text-xl mb-2.5 mr-2">Relevant Cards</div>
      <div className="text-sm"><u onClick={() => setShowModal(true)}>(Click here to see enlarged images)</u></div>
      <div className="flex flex-wrap justify-center items-center">
        {
          currentQuiz.relevantCards.map((cardName: string, index: number) => {
            const scaleClass = isHorizontalCard(cardName)
              ? `w-fit`
              : `h-fit`;

            const scaleStyle = isHorizontalCard(cardName)
              ? { height: `${scale}rem` }
              : { width: `${scale}rem` };
          return <div key={index} className={`${scaleClass} m-2.5 align`} style={scaleStyle}>
            <img src={`https://swudb.com/cdn-cgi/image/quality=40/images/cards/${cardName}.png`} alt={`card ${cardName}`} className="max-h-full object-contain" />
          </div>
          })
        }
      </div>
    </div>
    : <div className="w-fit h-72 m-2.5">
      <img src="/assets/SWUniversity_Cardback.png" alt="card back" className="max-h-full object-contain" />
    </div>
  }
  </div>
}

function isHorizontalCard(cardName: string): boolean {
  const setsMap = {
    "SOR": 30,
    "SHD": 26,
    "TWI": 30,
    "JTL": 30,
    "LOF": 30,
    "SEC": 26,
  };

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

const getScaleForCards = (count: number): number => {
    const scales: Record<number, number> = {
      1: 18,
      2: 16,
      3: 14,
      4: 13,
      5: 9.5,
      6: 13,
      7: 13,
      8: 13,
      9: 13,
      10: 9.5,
    };

    return scales[Math.min(count, 10)] || 8;
  };