import { DiscordLink } from "../util/const";
import { globalBackgroundStyle } from "../util/style-const";

function AboutPage() {
  return <div className={`p-8 lg:p-20 border h-[85vh] ${globalBackgroundStyle}
      text-center text-lg md:text-3xl uwd:text-5xl 4k:text-7xl font-bold flex flex-col gap-4`}>
    <h1 className="text-3xl md:text-7xl md:mb-16">About SWUniversity</h1>
    <p className="w-full md:w-3/4 mx-auto">SWUniversity is a passion project operated by a small group of players interested in helping others learn STAR WARS: Unlimited, and have fun doing so!</p>
    <div className="m-12 flex flex-col gap-8">
      <p>Project Lead: Mobyus1</p>
      <p>Programming: ninin</p>
      <p>Quiz QA: Chanter</p>
    </div>
    <p>For questions/feedback, please visit our <a href={DiscordLink}
      className="text-blue-500 underline"
      target="_blank"
      rel="noopener noreferrer">
        Discord
      </a>!
    </p>
  </div>;
}

export default AboutPage;
