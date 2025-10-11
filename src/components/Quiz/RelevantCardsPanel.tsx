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
      <div className="flex flex-wrap justify-center items-center max-h-180 uwd:max-h-240 4k:max-h-320 overflow-y-auto">
        {
          currentQuiz.relevantCards.map((cardName: string, index: number) => {
            const scaleClass = isHorizontalCard(cardName)
              ? `w-fit`
              : `h-fit`;

            const scaleStyle = isHorizontalCard(cardName)
              ? { height: `${scale}vh`, }
              : { width: `${scale}vh`, };
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
    const minScale = 16;
    const scales: Record<number, number> = {
      1: 24,
      2: 24,
      3: 24,
      4: 22,
    };

    return count < 5
      ? scales[count]
      : count % 5 === 0 ? minScale : (count % 5 === 4 ? minScale + 1 : minScale + 4);
  };
