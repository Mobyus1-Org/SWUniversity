import { globalBackgroundStyle } from "../util/style-const";
import NewsCarousel from "../components/Home/NewsCarousel";

function HomePage() {
  return <div className="grid md:grid-cols-3 gap-4 md:gap-8 xl:h-[50vh]">
    <div className={`p-4 xl:p-16 uwd:!p-20 4k:!p-24 border col-span-3 xl:col-span-1 xl:min-h-[50vh] xl:max-h-[50vh] ${globalBackgroundStyle}`}>
      <h1 className="text-3xl uwd:text-4xl 4k:text-5xl uwd:mb-2 4k:mb-4 font-bold">Welcome to the <img src="/assets/HomepageLogo.png" alt="SWUniversity Banner" className="my-4 uwd:my-8"/></h1>
      <p className="text-md uwd:text-2xl 4k:text-4xl 4k:mb-4">This is a place where STAR WARS: Unlimited players can test their knowledge of the game they love to play!</p>
      <p className="text-md uwd:text-2xl 4k:text-4xl 4k:mb-4"><br />
        Please be patient as we continue to develop the site! We're planning on having multiple game modes which will be accessible from the menu at the top of your screen! Keep checking back for more updates!
        <br />
        <br />
        Thank you and have fun!
      </p>
    </div>
    <div className={`p-4 border col-span-3 xl:col-span-2 xl:min-h-[50vh] xl:max-h-[50vh] ${globalBackgroundStyle}`}>
      <NewsCarousel />
    </div>
  </div>;
}

export default HomePage;
