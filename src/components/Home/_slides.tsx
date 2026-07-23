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
    type: "embed",
    title: "Puzzle Mode is Here!",
    src: "https://www.youtube.com/embed/P6sN_z0GP7M",
    description: "Introducing SWUniversity's third game mode: Puzzle Mode!\n\nNow you can test your ability to analyze a game state and find the path to victory!  Challenge yourself on puzzles of varying difficulties, ranging from the level 1 beginner-friendly puzzles all the way to the level 5 hardcore competitive SWU player puzzles!\n\nBy registering, you can also track which puzzles you've solved already and which ones you're still working on!\n\nWe also welcome users to join our Discord server (link in the top-right of the screen!) and share their own puzzle ideas they may like to see included on the site!\n\nHope you enjoy!",
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
