type SlideType = "paragraph" | "image" | "embed";

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
    description: "We're excited to announce the launch of the Iron Man Challenge! Test your skills and see how many questions you can complete in a row without any mistakes. This new mode is designed to push your knowledge and endurance to the limit.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, urna eu tincidunt consectetur, nisi nisl aliquam nunc, eget aliquam massa nisl quis neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse potenti. Etiam euismod, urna eu tincidunt consectetur, nisi nisl aliquam nunc, eget aliquam massa nisl quis neque.",
  },
  {
    type: "image",
    alt: "image of rule of the week, from rule book",
    title: "Rule of the Week: The Hand Zone",
    src: "https://gcdnb.pbrd.co/images/XNKjp7GUJN0N.png?o=1",
    description: "The hand is a special zone where cards are kept before they are played. Players can only play cards from their hand during their turn.",
  },
  {
    type: "embed",
    title: "Does FFG Know SWU?",
    src: "https://www.youtube.com/embed/hWPWmIUUXcI",
    description: "A fun video where Mobyus1 tests FFG SWU creators' knowledge of the cards they made!",
  },
];