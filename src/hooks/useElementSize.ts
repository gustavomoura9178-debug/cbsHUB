import { useLayoutEffect, useRef, useState } from "react";
export function useElementSize() {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      setSize((old) =>
        old.width === next.width && old.height === next.height ? old : next,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  });
  return { ref, ...size };
}
