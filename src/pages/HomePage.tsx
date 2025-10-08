import { globalBackgroundStyle } from "../util/const";

function HomePage() {
  return <div className="grid md:grid-cols-3 gap-4 md:gap-8">
    <div className={"p-4 border md:col-span-2 " + globalBackgroundStyle}>
      <h1 className="text-3xl font-bold">Welcome to SWUniversity!</h1>
      <p className="text-lg">This is a place where STAR WARS: Unlimited players can test their knowledge of the game they love to play!</p>
      <p className="text-lg">Please be patient as we continue to develop the site! Thank you and have fun!</p>
    </div>
    <div className={"p-4 border md:col-span-1 " + globalBackgroundStyle}>
      <h1 className="text-3xl font-bold">News</h1>
      <div>
        <h3>Some Good News!</h3>
        <img src="https://static0.cbrimages.com/wordpress/wp-content/uploads/2020/11/death-star-in-rogue-one.jpg" alt="Some Good News" />
        <p className="text-lg">
          We are excited to announce that we have some good news to share with you! Our team has been working hard to improve the SWUniversity experience, and we are thrilled to unveil some new features and updates that we believe will enhance your enjoyment of the site. Stay tuned for more details in the coming weeks!
        </p>
      </div>
    </div>
    <div className={"p-4 border md:col-span-3 " + globalBackgroundStyle}>
      <h1 className="text-3xl font-bold">Useful Resources</h1>
      <ul className="list-disc list-inside">
        <li><a href="https://swudb.com" className="text-blue-500 underline">SWUDB</a> - Comprehensive database of STAR WARS: Unlimited cards and sets.</li>
        <li><a href="https://forcetable.com" className="text-blue-500 underline">Force Table</a> - A website for STAR WARS: Unlimited players to play against a simulated opponent. Great for practicing a new deck.</li>
        <li><a href="https://karabast.net" className="text-blue-500 underline">Karabast</a> - A platform for online PvP matches. Includes public and private lobbies as well as a quick-match queue.</li>
        <li><a href="https://swustats.net" className="text-blue-500 underline">SWUStats</a> - A website for building decks and tracking their performance when played on Karabast.</li>
      </ul>
    </div>
  </div>;
}

export default HomePage;
