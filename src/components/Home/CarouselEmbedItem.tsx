import type { ICarouselItemProps } from "./_slides";

export function CarouselEmbedItem({ src, description }: ICarouselItemProps) {
  const isPortrait = window.innerWidth < window.innerHeight;
  return <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden p-2">
      <iframe
        width="50%"
        height={isPortrait ? "90%" : "70%"}
        src={src}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen>
      </iframe>
      <p className="p-16">{description}</p>
  </div>;
}