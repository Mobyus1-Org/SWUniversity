interface IProps {
  resetQuizMode: () => void;
}

export function MarathonModeEndScreen({
  resetQuizMode,
}: IProps) {
  return <div className="text-center m-[35%_10%] lg:m-[15%_10%]">
    <p className="text-2xl md:text-4xl font-bold mb-4 h-32">You've correctly answered every question!</p>
    <button className="btn btn-primary text-lg p-4" onClick={resetQuizMode}>Go Back to Quiz Menu</button>
  </div>
}