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
    title: "Iron Man Challenge Is Here!",
    src: "/assets/rivals-fall-splash.png",
    description: "We're excited to announce the launch of the Iron Man Challenge! Test your skills and see how many questions you can complete in a row without any mistakes. This new mode is designed to push your knowledge and endurance to the limit.",
  },
  {
    type: "banner-text",
    alt: "image of rule of the week, from rule book",
    title: "Rule of the Week: The Hand Zone",
    src: "/assets/banners/hand.png",
    description: "The hand is a special zone where cards are kept before they are played. Players can only play cards from their hand during their turn unless a card specifies otherwise. Cards in a player's hand are considered \"hidden information,\" meaning a player is not required to divulge any information about what they may or may not be holding. If an opponent asks you a question about what a particular card says or does, don't be afraid to call a judge over to provide an answer as to not unintentionally hint at what may be in your hand!",
  },
  {
    type: "embed",
    title: "Does FFG Know SWU?",
    src: "https://www.youtube.com/embed/hWPWmIUUXcI",
    description: "A fun video where Mobyus1 tests FFG SWU creators' knowledge of the cards they made!",
  },
];
