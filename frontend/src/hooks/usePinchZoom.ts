import { useRef, useState, useCallback } from 'react';

function touchDist(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Pinch-to-zoom + double-tap + pan hook for mobile image viewers, plus the
 * desktop equivalent: mouse wheel to zoom, click-drag to pan, double-click
 * to toggle. Both input types share the same scale/pan state.
 *
 * Usage:
 *   const pinch = usePinchZoom();
 *   <div
 *     ref={pinch.ref}
 *     onTouchStart={pinch.onTouchStart}
 *     onTouchEnd={pinch.onTouchEnd}
 *     onMouseDown={pinch.onMouseDown}
 *     onDoubleClick={pinch.onDoubleClick}
 *   >
 *     <img style={pinch.imgStyle} draggable={false} />
 *   </div>
 *
 * - Attach `ref` to the scrollable container (receives the non-passive touchmove/wheel listeners).
 * - Attach `onTouchStart` / `onTouchEnd` / `onMouseDown` / `onDoubleClick` to the same element.
 * - Apply `imgStyle` to the <img> element.
 * - Call `reset()` when the viewer closes or the image changes.
 * - Read `isZoomed` to disable competing gestures (e.g. swipe-to-navigate).
 */
export function usePinchZoom(maxScale = 4) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });

  // Always-fresh ref so event handler closures never go stale.
  const tRef = useRef(t);
  tRef.current = t;

  const containerElRef = useRef<HTMLDivElement | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  // Gesture state stored in a ref (never needs to trigger re-render).
  const g = useRef({
    d0: 0,      // initial pinch distance
    s0: 1,      // scale at pinch start
    x0: 0,      // touch X at pan start
    y0: 0,      // touch Y at pan start
    tx0: 0,     // translate X at pan start
    ty0: 0,     // translate Y at pan start
    tap: 0,     // timestamp of last single tap (for double-tap detection)
  });

  // Callback ref: attaches the non-passive touchmove listener as soon as the
  // container mounts, instead of only once at hook-init time. A plain
  // useRef + useEffect([]) would miss the element entirely when the
  // container is conditionally rendered (e.g. a lightbox that isn't open
  // yet when this hook first runs) since refs aren't reactive.
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    detachRef.current?.();
    detachRef.current = null;
    containerElRef.current = node;
    if (!node) return;

    const handleMove = (e: TouchEvent) => {
      const c = tRef.current;
      const gv = g.current;

      if (e.touches.length === 2) {
        e.preventDefault();
        const newS = Math.max(1, Math.min(maxScale, gv.s0 * (touchDist(e.touches[0], e.touches[1]) / gv.d0)));
        setT(prev => ({ ...prev, s: newS }));
      } else if (e.touches.length === 1 && c.s > 1) {
        e.preventDefault();
        setT({
          s: c.s,
          x: gv.tx0 + e.touches[0].clientX - gv.x0,
          y: gv.ty0 + e.touches[0].clientY - gv.y0,
        });
      }
    };

    node.addEventListener('touchmove', handleMove, { passive: false });

    // Wheel-to-zoom, centered on the image (matches transform-origin: center).
    // Registered as a raw non-passive listener for the same reason as
    // touchmove: React's synthetic onWheel is passive by default, so
    // e.preventDefault() inside it would not actually stop page scroll.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = tRef.current;
      const zoomFactor = Math.exp(-e.deltaY * 0.001);
      const newS = Math.max(1, Math.min(maxScale, c.s * zoomFactor));
      if (newS <= 1.01) {
        setT({ s: 1, x: 0, y: 0 });
      } else {
        setT(prev => ({ ...prev, s: newS }));
      }
    };
    node.addEventListener('wheel', handleWheel, { passive: false });

    detachRef.current = () => {
      node.removeEventListener('touchmove', handleMove);
      node.removeEventListener('wheel', handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxScale]);

  const onTouchStart = (e: React.TouchEvent) => {
    const c = tRef.current;
    const gv = g.current;

    if (e.touches.length === 2) {
      gv.d0 = touchDist(e.touches[0], e.touches[1]);
      gv.s0 = c.s;
      gv.tx0 = c.x;
      gv.ty0 = c.y;
    } else if (e.touches.length === 1 && c.s > 1) {
      gv.x0 = e.touches[0].clientX;
      gv.y0 = e.touches[0].clientY;
      gv.tx0 = c.x;
      gv.ty0 = c.y;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const c = tRef.current;
    const gv = g.current;

    // Snap back to scale 1 if barely pinched.
    if (c.s < 1.05) {
      setT({ s: 1, x: 0, y: 0 });
      return;
    }

    // Double-tap: toggle between 1× and 2.5×.
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const now = Date.now();
      if (now - gv.tap < 300) {
        setT(c.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 });
        gv.tap = 0;
      } else {
        gv.tap = now;
      }
    }
  };

  // Click-drag to pan once zoomed in (desktop equivalent of the one-finger pan above).
  const onMouseDown = (e: React.MouseEvent) => {
    if (tRef.current.s <= 1.05) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startTx = tRef.current.x;
    const startTy = tRef.current.y;

    const handleMouseMove = (ev: MouseEvent) => {
      setT(prev => ({ ...prev, x: startTx + (ev.clientX - startX), y: startTy + (ev.clientY - startY) }));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Double-click: desktop equivalent of double-tap, toggles between 1x and 2.5x.
  const onDoubleClick = () => {
    const c = tRef.current;
    setT(c.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 });
  };

  const reset = () => setT({ s: 1, x: 0, y: 0 });

  const imgStyle: React.CSSProperties = {
    transform: `scale(${t.s}) translate(${t.x / t.s}px, ${t.y / t.s}px)`,
    transformOrigin: 'center',
    transition: t.s === 1 ? 'transform 0.25s ease' : 'none',
    userSelect: 'none',
    willChange: 'transform',
    cursor: t.s > 1.05 ? 'grab' : 'zoom-in',
  };

  return {
    ref: setContainerRef,
    isZoomed: t.s > 1.05,
    scale: t.s,
    imgStyle,
    reset,
    onTouchStart,
    onTouchEnd,
    onMouseDown,
    onDoubleClick,
  };
}
