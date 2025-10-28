import React from "react";
import type { ICarouselItemProps } from "./_slides";

export function CarouselParagraphItem({ src, alt, children }: ICarouselItemProps) {
  if(!children || React.Children.count(children) !== 1 || (children as React.ReactElement).type !== 'p') {
    throw new Error("CarouselItem children must be a singular paragraph element");
  }

  return <div className="flex flex-col items-center justify-start h-full w-full text-center overflow-hidden p-2">
    <div className="w-full clearfix">
      <img src={src} alt={alt || 'news image'} className="w-full p-1 md:p-0 md:float-right md:object-cover md:w-7/16 md:mx-8 mb-2 rounded"/>
      {children}
    </div>
  </div>;
}