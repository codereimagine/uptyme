import { useLayoutEffect, useState, type RefObject } from 'react';
import { useVisualViewport } from './useVisualViewport';

/**
 * Scale-to-fit: returns the factor that makes `ref`'s natural (untransformed)
 * box fit inside the visible viewport, capped at 1 (scale-DOWN only — keeps
 * text/SVG crisp). The stage is top-aligned in CSS (see .stage-wrap), so this
 * only governs size, not position.
 *
 * The element is measured with offsetWidth/offsetHeight, which report the
 * LAYOUT size and are immune to CSS transforms — so applying the result via
 * transform doesn't feed back into the measurement. Recomputes on
 * visual-viewport changes (browser chrome / keyboard) and on content resize.
 */
export function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const vv = useVisualViewport();
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const availW = vv.width || window.innerWidth;
      const availH = vv.height || window.innerHeight;
      const natW = el.offsetWidth;
      const natH = el.offsetHeight;
      if (!natW || !natH || !availW || !availH) return;
      setScale(Math.min(availW / natW, availH / natH, 1));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [ref, vv.width, vv.height]);

  return scale;
}
