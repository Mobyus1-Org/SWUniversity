export const setLightsaberColor = (color: keyof typeof LightsaberColors) => {
  const [r, g, b] = LightsaberColors[color];
  document.documentElement.style.setProperty('--lightsaber-r', r.toString());
  document.documentElement.style.setProperty('--lightsaber-g', g.toString());
  document.documentElement.style.setProperty('--lightsaber-b', b.toString());
};

export const LightsaberColors = {
  lightBlue: [0, 160, 255],
  blue: [46, 103, 248],
  green: [0, 255, 100],
  orange: [255, 140, 0],
  red: [255, 50, 50],
  purple: [138, 43, 226],
  yellow: [255, 255, 0],
  white: [255, 255, 255],
} as const;

export const lightsaberGlow = "shadow-[0_0_20px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.85)]";
export const lightsaberGlowBig = "shadow-[0_0_100px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.85)]";
export const lightsaberGlowHover = "transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.85)]";
export const globalBackgroundStyle = "bg-[rgba(23,35,87,0.7)] backdrop-blur-xs shadow-[0_0_20px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.85)]";
export const globalBackgroundStyleBigShadow = "bg-[rgba(23,35,87,0.7)] backdrop-blur-xs shadow-[0_0_120px_rgba(var(--lightsaber-r),var(--lightsaber-g),var(--lightsaber-b),0.85)]";
export const globalBackgroundStyleNoShadow = `bg-[rgba(23,35,87,0.7)] backdrop-blur-xs`;
export const globalBackgroundStyleOpaque = `bg-[rgba(23,35,87,1)]`;