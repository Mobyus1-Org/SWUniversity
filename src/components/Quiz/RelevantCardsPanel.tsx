import type { ModalKey } from "../../util/context";
import { getSWUDBImageLink, getSWUDBImageLinkFallback, isHorizontalCard, type Quiz } from "../../util/func";

interface IProps {
  currentQuiz: Quiz;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  setModalKey: React.Dispatch<React.SetStateAction<ModalKey>>;
}

export function RelevantCardsPanel({ currentQuiz, setShowModal, setModalKey }: IProps) {
  const scale = getScaleForCards(currentQuiz.relevantCards.length);

  const setRelevantCardsModal = () => {
    setModalKey("relevant-cards");
    setShowModal(true);
  }

  return <div className="flex-1 flex flex-[0_0_50%] flex-wrap items-center justify-center">
  {
    currentQuiz.relevantCards.length > 0
    ? <div>
      <div className="text-xl mb-2.5 mr-2 uwd:text-3xl 4k:text-5xl">Relevant Cards</div>
      <div className="text-sm uwd:text-xl 4k:text-3xl"><u onClick={setRelevantCardsModal}>(Click here to see enlarged images)</u></div>
      <div className="flex flex-wrap justify-center items-center max-h-180 uwd:max-h-240 4k:max-h-320 overflow-y-auto">
        {
          currentQuiz.relevantCards.map((cardName: string, index: number) => {
            const scaleClass = isHorizontalCard(cardName) ? "w-fit" : "h-fit";
            const scaleStyle = isHorizontalCard(cardName) ? { height: `${scale}vh`, } : { width: `${scale}vh`, };
            return <div key={"relevant-card-" + index} className={`${scaleClass} m-2.5 align`} style={scaleStyle}>
              <img
                src={getSWUDBImageLink(cardName)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null; // Prevent infinite loop
                  target.src = getSWUDBImageLinkFallback(cardName);
                }}
                alt={`card ${cardName}`}
                className="max-h-full object-contain"
              />
            </div>
          })
        }
      </div>
    </div>
    : <img src="/assets/SWUniversity_Cardback.png" alt="card back" className="w-fit md:w-1/2 lg:w-1/3 xl:w-1/4" />

  }
  </div>
}

const getScaleForCards = (count: number): number => {
    const minScale = 16;
    const scales: Record<number, number> = {
      1: 24,
      2: 24,
      3: 24,
      4: 20,
    };

    return count < 5
      ? scales[count]
      : count % 5 === 0 ? minScale : (count % 5 === 4 ? minScale + 1 : minScale + 4);
  };
