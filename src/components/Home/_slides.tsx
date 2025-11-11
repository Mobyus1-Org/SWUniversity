type SlideType = "paragraph" | "image" | "embed" | "banner-text";

export interface ICarouselData {
    type: SlideType;
    title: string;
    src: string;
    description?: string;
    alt?: string;
}

export interface ICarouselItemProps {
    data: ICarouselData;
}

export const slides: ICarouselData[] = [
  {
    type: "paragraph",
    title: "SWUniversity Is Live!",
    src: "/assets/WelcomeToSWU.png",
    description: "Welcome to SWUniversity.net — your ultimate training ground for Star Wars: Unlimited!\n\nWhether you’re just opening your first booster pack or looking to refine your competitive edge, SWUniversity.net is here to guide you through every step of the journey. Our Quiz game mode offers a way to learn both the fundamentals of the game, as well as some of the most obscure card interactions! All of the questions in our database are verified by actual SWU judges before being added to the site!\n\nIf you're looking for something a little different, our "Do You Know SWU?" mode lets you test your knowledge of individual cards! How well *DO* you know SWU?\n\nDon't foret to check out our Discord server where you can learn, play, and have fun with a community of fans who love Star Wars: Unlimited just as much as you do!",
  },
  {
    type: "paragraph",
    title: "Iron Man Challenge Is Here!",
    src: "/assets/rivals-fall-splash.png",
    description: "We're excited to announce the launch of the Iron Man Challenge! Test your skills and see how many questions you can complete in a row without making any mistakes. This new mode is designed to push your knowledge and endurance to the limit.\n\nHaving fun on SWUniversity.net? Stay tuned for more unique ways to test yourself coming in the future!",
  },
  {
    type: "banner-text",
    alt: "image of rule of the week, from rule book",
    title: "Rule of the Week: The Hand Zone",
    src: "/assets/banners/hand.png",
    description: "The hand is a special zone where cards are kept before they are played. Players can only play cards from their hand during their turn unless a card specifies otherwise. Cards in a player's hand are considered \"hidden information,\" meaning a player is not required to divulge any information about what they may or may not be holding.\n\nIf an opponent asks you a question about what a particular card says or does, don't be afraid to call a judge over to provide an answer as to not unintentionally hint at what may be in your hand!",
  },
  {
    type: "embed",
    title: "Does FFG Know SWU?",
    src: "https://www.youtube.com/embed/hWPWmIUUXcI",
    description: "In this video, Mobyus1 tests FFG SWU creators' knowledge of the cards they made! Think this looks fun? You can try try it yourself by playing the \"DYKSWU?\" mode here on this site!",
  },
];
