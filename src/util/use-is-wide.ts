import React from "react";

/**
 * Live viewport-width predicate backed by matchMedia. Returns true at/above `minWidthPx`.
 * SSR-safe: assumes wide until mounted, then corrects, so the server render is deterministic.
 */
export function useIsWide(minWidthPx = 640): boolean {
  const query = `(min-width: ${minWidthPx}px)`;
  const [isWide, setIsWide] = React.useState(true);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsWide(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isWide;
}
