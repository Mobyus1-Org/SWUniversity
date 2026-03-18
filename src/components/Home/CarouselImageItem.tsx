import type { ICarouselItemProps } from "@/components/Home/_slides";

export function CarouselImageItem({ data }: ICarouselItemProps) {
  const { src, alt, description } = data;
  return (
    <div className="flex flex-col items-center justify-start w-full text-center overflow-hidden">
      <div className="w-full h-3/4 mb-2 rounded shadow-lg overflow-hidden flex items-center justify-center">
        <img src={src} alt={alt || 'news image'} className="w-full h-full object-cover" />
      </div>
      <div className="overflow-y-auto w-full flex-1 px-2">
        <p className="text-lg uwd:text-2xl 4k:text-4xl mb-4">{description}</p>
      </div>
    </div>
  );
}