function HomePage() {
  return <div className="p-6 space-y-4">
    <div className={`${globalBackgroundStyle} border p-4 rounded flex flex-col items-center justify-center flex-1`}>
        <h3 className="text-xl mb-4">Choose a number of questions and see how many you can answer correctly!</h3>
    </div>
    <h1 className="text-3xl font-bold">Welcome to the SWUniversity</h1>
    <p className="text-lg">This is a place where STAR WARS: Unlimited players can test their knowledge of the game they love to play!</p>
    <p className="text-lg">Please be patient as we continue to develop the site! Thank you and have fun!</p>
  </div>;
}

export default HomePage;
