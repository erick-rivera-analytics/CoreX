"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function ScrollFadeTable({
  children,
  className,
  innerClassName,
  topScrollbar = false,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /**
   * Si `true`, renderiza un scrollbar horizontal adicional arriba del contenido
   * sincronizado con el scrollbar inferior nativo. Útil para tablas anchas en las
   * que el scrollbar nativo queda fuera de vista hasta llegar al final.
   */
  topScrollbar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const topInnerRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showLeftFade, setShowLeftFade] = useState(false);

  // Sincroniza el scrollbar superior con el ancho real del contenido.
  useEffect(() => {
    if (!topScrollbar) return;
    const element = ref.current;
    const topInner = topInnerRef.current;
    if (!element || !topInner) return;

    const updateWidth = () => {
      topInner.style.width = `${element.scrollWidth}px`;
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(element);
    window.addEventListener("resize", updateWidth, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [topScrollbar]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 2;
      setShowRightFade(hasOverflow && element.scrollLeft < element.scrollWidth - element.clientWidth - 2);
      setShowLeftFade(hasOverflow && element.scrollLeft > 1);

      // Sincroniza scrollbar superior cuando el inferior se mueve.
      if (topScrollbar && topRef.current && topRef.current.scrollLeft !== element.scrollLeft) {
        topRef.current.scrollLeft = element.scrollLeft;
      }
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [topScrollbar]);

  // Sincroniza scrollbar inferior cuando el superior se mueve.
  const onTopScroll = () => {
    const inner = ref.current;
    const top = topRef.current;
    if (!inner || !top) return;
    if (inner.scrollLeft !== top.scrollLeft) {
      inner.scrollLeft = top.scrollLeft;
    }
  };

  return (
    <div className={cn("relative overflow-hidden rounded-[16px]", className)}>
      {topScrollbar ? (
        <div
          ref={topRef}
          onScroll={onTopScroll}
          className="overflow-x-auto show-scrollbar"
          aria-hidden="true"
        >
          <div ref={topInnerRef} style={{ height: 1 }} />
        </div>
      ) : null}
      <div ref={ref} className={cn("overflow-x-auto show-scrollbar tabular-nums", innerClassName)}>
        {children}
      </div>
      {showLeftFade ? <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent" /> : null}
      {showRightFade ? <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" /> : null}
    </div>
  );
}
