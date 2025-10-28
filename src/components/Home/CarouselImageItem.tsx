import React from "react";
import type { ICarouselItemProps } from "./_slides";

export function CarouselImageItem({ src, alt, children }: ICarouselItemProps) {
  if (!children || React.Children.count(children) !== 1 || (children as React.ReactElement).type !== 'p') {
    throw new Error("CarouselItem children must be a singular paragraph element");
  }

  return (
    <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden p-2">
      <img src={src} alt={alt || 'news image'} className="w-full h-3/4 object-cover mx-auto mb-2 rounded shadow-lg" />
      <div className="overflow-y-auto w-full flex-1 px-2">
        {children}
      </div>
    </div>
  );
}