import React from "react";
import { CarouselParagraphItem } from "./CarouseParagraphltem";
import { CarouselImageItem } from "./CarouselImageItem";
import { slides } from "./_slides";
import { CarouselEmbedItem } from "./CarouselEmbedItem";
import { CarouselBannerTextItem } from "./CarouselBannerTextItem";

export default function NewsCarousel() {
	const [current, setCurrent] = React.useState(0);
	const [maxHeight, setMaxHeight] = React.useState<number | undefined>(undefined);
	const slideRefs = React.useRef<(HTMLDivElement | null)[]>([]);
	const goTo = (idx: number) => setCurrent((idx + slides.length) % slides.length);

	// Measure all slides after mount and on window resize
	React.useEffect(() => {
		function measureHeights() {
			const heights = slideRefs.current.map(ref => ref?.offsetHeight || 0);
			setMaxHeight(Math.max(...heights));
		}
		measureHeights();
		window.addEventListener('resize', measureHeights);
		return () => window.removeEventListener('resize', measureHeights);
	}, []);

	// Render all slides offscreen for measurement, but only show the current one
		return (
			<div className="w-full flex flex-col items-center mt-4 select-none">
				<div className="w-full flex flex-col items-center">
					<h1 className="text-3xl uwd:text-4xl 4k:text-5xl mb-4 font-bold text-center">
						{slides[current].title}
					</h1>
					<div
						className="relative w-full flex flex-col justify-between items-center overflow-hidden"
					>
						{/* Offscreen slides for measurement */}
						<div style={{ position: 'absolute', left: '-9999px', top: 0, visibility: 'hidden', pointerEvents: 'none', width: '100%' }}>
							{slides.map((slide, idx) => (
								<div
									key={idx}
									ref={el => { slideRefs.current[idx] = el; }}
									className="flex-1 flex justify-center w-full items-stretch p-8"
									style={{ boxSizing: 'border-box' }}
								>
									{slide.type === "paragraph" && <CarouselParagraphItem data={slide} />}
									{slide.type === "image" && <CarouselImageItem data={slide} />}
									{slide.type === "embed" && <CarouselEmbedItem data={slide} />}
									{slide.type === "banner-text" && <CarouselBannerTextItem data={slide} />}
								</div>
							))}
						</div>
						{/* Visible slide */}
						<div
							className="flex-1 flex justify-center w-full items-stretch p-8"
							style={maxHeight ? { minHeight: maxHeight, boxSizing: 'border-box' } : { boxSizing: 'border-box' }}
						>
							{slides[current].type === "paragraph" && <CarouselParagraphItem data={slides[current]} />}
							{slides[current].type === "image" && <CarouselImageItem data={slides[current]} />}
							{slides[current].type === "embed" && <CarouselEmbedItem data={slides[current]} />}
							{slides[current].type === "banner-text" && <CarouselBannerTextItem data={slides[current]} />}
						</div>
						<div className="absolute left-1/4 bottom-0 w-1/2 flex items-center justify-between z-1">
							<button
								aria-label="Previous slide"
								className="text-gray-400 hover:text-white text-3xl px-4 py-2 focus:outline-none"
								onClick={() => goTo(current - 1)}
							>
								<span>&#60;</span>
							</button>
							<div className="flex justify-center items-center gap-2">
								{slides.map((_, idx) => (
									<span
										key={idx}
										className={`h-1.5 w-6 rounded bg-gray-400 transition-all duration-200 ${
											idx === current ? "bg-white" : "opacity-50"
										}`}
									/>
								))}
							</div>
							<button
								aria-label="Next slide"
								className="text-gray-400 hover:text-white text-3xl px-4 py-2 focus:outline-none"
								onClick={() => goTo(current + 1)}
							>
								<span>&#62;</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		);
}
