import type { ICarouselItemProps } from "./_slides";

export function CarouselParagraphItem({ data }: ICarouselItemProps) {
  const { src, alt, description } = data;

  //in the description, look for \n and replace with <br/> tags
  const formattedDescription = description?.split("\n").map((line, index) => (
    <span key={index}>
      {line}
      <br />
    </span>
  ));

  return <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden">
    <div className="w-full clearfix">
      <img src={src} alt={alt || 'news image'} className="w-full p-1 md:p-0 md:float-right md:object-cover md:w-7/16 md:mx-8 mb-2 rounded"/>
      <p className="text-lg uwd:text-2xl 4k:text-4xl mb-4 text-left">{formattedDescription}</p>
    </div>
  </div>;
}