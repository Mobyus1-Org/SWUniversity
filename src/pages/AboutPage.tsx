import { DiscordLink } from "../util/const";
import { globalBackgroundStyle } from "../util/style-const";

function AboutPage() {
  return <div className={`p-20 border h-[85vh] ${globalBackgroundStyle}
      text-center text-3xl uwd:text-5xl 4k:text-7xl font-bold flex flex-col gap-12`}>
    <h1 className="text-7xl">About SWUniversity</h1>
    <p>SWUniversity is a passion project operated by a small group of players interested in helping others learn STAR WARS: Unlimited, and have fun doing so!</p>
    <p>Project Lead: Mobyus1</p>
    <p>Programming: ninin</p>
    <p>Quiz QA: Chanter</p>
    <p> </p>
    <p>For questions/feedback, please visit our <a href={DiscordLink} target="_blank" rel="noopener noreferrer">Discord!</a></p>
  </div>;
}

export default AboutPage;
