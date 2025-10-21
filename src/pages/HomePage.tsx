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
        <h3 className="text-2xl uwd:text-3xl 4k:text-4xl">Some Good News!</h3>
        <img src="https://static0.cbrimages.com/wordpress/wp-content/uploads/2020/11/death-star-in-rogue-one.jpg" alt="Some Good News" />
        <p className="text-lg uwd:text-2xl 4k:text-4xl mb-4">
          Our team has been working hard to improve the SWUniversity experience, and we are thrilled to unveil some new features and updates that we believe will enhance your enjoyment of the site. Stay tuned for more details in the coming weeks!
        </p>
      </div>
    </div>
    <div className={`p-4 border md:col-span-3 ${globalBackgroundStyle}`}>
      <h1 className="text-3xl uwd:text-4xl 4k:text-5xl mb-4 font-bold">Useful Resources</h1>
      <ul className="list-disc list-inside text-lg uwd:text-2xl 4k:text-4xl">
        <li className="mb-1"><a href="https://starwarsunlimited.com/how-to-play?chapter=rules" className="text-blue-500 underline" target="_blank">Official SWU Rules</a> - The STAR WARS: Unlimited rules documents on the official SWU website.</li>
        <li className="mb-1"><a href="https://swudb.com" className="text-blue-500 underline" target="_blank">SWUDB</a> - Comprehensive database of STAR WARS: Unlimited cards and sets.</li>
        <li className="mb-1"><a href="https://nexus.cascadegames.com/resources/Rules_Clarifications/" className="text-blue-500 underline" target="_blank">SWU Rules Clarifications</a> - Official collection of SWU rules and policy clarifications you won't find in the Comprehensive Rules.</li>
        <li className="mb-1"><a href="https://nexus.cascadegames.com/" className="text-blue-500 underline" target="_blank">Cascade Nexus</a> - Join the STAR WARS: Unlimited Judge Program!</li>
        <li className="mb-1"><a href="https://www.forcetable.net/swu" className="text-blue-500 underline" target="_blank">Force Table</a> - A website for STAR WARS: Unlimited players to play against a simulated opponent. Great for practicing a new deck.</li>
        <li className="mb-1"><a href="https://karabast.net" className="text-blue-500 underline" target="_blank">Karabast</a> - A platform for online PvP matches. Includes public and private lobbies as well as a quick-match queue.</li>
        <li className="mb-1"><a href="https://swustats.net" className="text-blue-500 underline" target="_blank">SWUStats</a> - A website for building decks and tracking their performance when played on Karabast.</li>
        <li className="mb-1"><a href="https://alsoalpharius.github.io/swudle/" className="text-blue-500 underline" target="_blank">SWUdle</a> - STAR WARS: Unlimited Wordle!</li>
      </ul>
    </div>
  </div>;
}

export default HomePage;
