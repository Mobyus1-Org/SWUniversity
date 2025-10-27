import ResourcesList from "../components/Resources/ResourcesList";
import { globalBackgroundStyle } from "../util/style-const";

function HomePage() {
  return <div className="grid md:grid-cols-3 gap-4 md:gap-8">
    <div className={`p-4 border md:col-span-2 ${globalBackgroundStyle}`}>
      <h1 className="text-3xl uwd:text-4xl 4k:text-5xl uwd:mb-2 4k:mb-4 font-bold">Welcome to the <img src="/assets/HomepageLogo.png" alt="SWUniversity Banner" className="my-4 uwd:my-8"/></h1>
      <p className="text-lg uwd:text-2xl 4k:text-4xl 4k:mb-4">This is a place where STAR WARS: Unlimited players can test their knowledge of the game they love to play!</p>
      <p className="text-lg uwd:text-2xl 4k:text-4xl 4k:mb-4"><br />
        Please be patient as we continue to develop the site! We're planning on having multiple game modes which will be accessible from the menu at the top of your screen! Keep checking back for more updates!
        <br />
        <br />
        Thank you and have fun!
      </p>
    </div>
    <div className={`p-4 border md:col-span-1 ${globalBackgroundStyle}`}>
      <h1 className="text-3xl uwd:text-4xl 4k:text-5xl mb-4 font-bold">News</h1>
      <div>
        <h3 className="text-2xl uwd:text-3xl 4k:text-4xl">Iron Man Challenge Is Here!</h3>
        <img src="/assets/rivals-fall-splash.png" alt="Iron Man Challenge" />
        <br />
        <p className="text-lg uwd:text-2xl 4k:text-4xl mb-4">
          We're excited to announce the launch of the Iron Man Challenge! Test your skills and see how many questions you can complete in a row without any mistakes.
        </p>
      </div>
    </div>
    <div className={`p-4 border md:col-span-3 ${globalBackgroundStyle}`}>
      <h1 className="text-3xl uwd:text-4xl 4k:text-5xl mb-4 font-bold">Useful Resources</h1>
      <ResourcesList />
    </div>
  </div>;
}

export default HomePage;
