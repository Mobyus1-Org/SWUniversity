import type { ICarouselItemProps } from "./_slides";

export function CarouselImageItem({ data }: ICarouselItemProps) {
  const { src, alt, description } = data;
  return (
    <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden p-2">
      <img src={src} alt={alt || 'news image'} className="w-full h-3/4 object-cover mx-auto mb-2 rounded shadow-lg" />
      <div className="overflow-y-auto w-full flex-1 px-2">
        <p className="text-lg uwd:text-2xl 4k:text-4xl mb-4">{description}</p>
      </div>
    </div>
  );
}