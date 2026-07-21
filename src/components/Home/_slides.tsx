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
    description: "Welcome to SWUniversity.net — your ultimate training ground for Star Wars: Unlimited!\n\nWhether you’re just opening your first booster pack or looking to refine your competitive edge, SWUniversity.net is here to guide you through every step of the journey.\n\nOur \"Quiz\" game mode offers a way to learn both the fundamentals of the game, as well as some of the most obscure card interactions! All of the questions in our database are verified by actual SWU judges before being added to the site!\n\nIf you're looking for something a little different, our \"Do You Know SWU?\" mode lets you test your knowledge of individual cards! How well *DO* you know SWU?\n\nDon't forget to check out our Discord server where you can learn, play, and have fun with a community of fans who love Star Wars: Unlimited just as much as you do!",
  },
  {
    type: "paragraph",
    title: "Introducing User Profiles!",
    src: "/assets/banners/profilesHomeImg.png",
    description: "We're happy to finally bring SWUniversity's first major update since launch: User profiles!\n\nYou can now register for free in the top-right corner of the home page and track your progress and performance on SWUniversity!  Use this to not only see where you may want to spend more time studying, but also to challenge your friends!\n\nWith this year's Galactic Championship quickly approaching, there are more big things coming to SWUniversity right around the corner, so keep checking back!",
  },
  {
    type: "embed",
    title: "Does FFG Know SWU?",
    src: "https://www.youtube.com/embed/hWPWmIUUXcI",
    description: "In this video, Mobyus1 tests FFG SWU creators' knowledge of the cards they made! Think this looks fun? You can try try it yourself by playing the \"DYKSWU?\" mode here on this site!",
  },
];
