import { globalBackgroundStyle } from "../util/style-const";
import NewsCarousel from "../components/Home/NewsCarousel";
import { WelcomeSection } from "../components/Home/WelcomeSection";

function HomePage() {
  return (
    <div className="grid lg:grid-cols-8 gap-4 md:gap-8">
      <div className={`p-4 xl:p-16 uwd:!p-20 4k:!p-24 border col-span-3 lg:col-span-3 flex flex-col ${globalBackgroundStyle}`}>
        <WelcomeSection />
      </div>
      <div className={`p-4 border col-span-3 lg:col-span-5 flex flex-col ${globalBackgroundStyle}`}>
        <NewsCarousel />
      </div>
    </div>
  );
}

export default HomePage;
