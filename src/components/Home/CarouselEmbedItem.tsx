import type { ICarouselItemProps } from "./_slides";

export function CarouselEmbedItem({ data }: ICarouselItemProps) {
  const { src, description } = data;
  return (
    <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden">
      <div className="w-full lg:w-3/5 aspect-video rounded shadow-lg overflow-hidden flex items-center justify-center">
        <iframe
          className="w-full h-full object-cover"
          src={src}
          title="YouTube video player"
          allow="encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share; display-capture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <p className="mt-8">{description}</p>
    </div>
  );
}
