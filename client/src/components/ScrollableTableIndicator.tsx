import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

interface ScrollableTableIndicatorProps {
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

const ScrollableTableIndicator: React.FC<ScrollableTableIndicatorProps> = ({ containerRef }) => {
  const [showIndicator, setShowIndicator] = useState(false);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);

  const updateAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canScrollMore = scrollLeft < scrollWidth - clientWidth - 1;
    setShowIndicator(canScrollMore);

    if (!canScrollMore) return;

    const rect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const clampedRight = Math.min(rect.right, viewportWidth);
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);

    if (visibleBottom > visibleTop) {
      setTop((visibleTop + visibleBottom) / 2);
      setLeft(clampedRight - 56);
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateAll();

    container.addEventListener('scroll', updateAll);
    window.addEventListener('scroll', updateAll, { passive: true });
    window.addEventListener('resize', updateAll);

    return () => {
      container.removeEventListener('scroll', updateAll);
      window.removeEventListener('scroll', updateAll);
      window.removeEventListener('resize', updateAll);
    };
  }, [containerRef, updateAll]);

  const scrollToEnd = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: containerRef.current.scrollWidth, behavior: 'smooth' });
    }
  };

  if (!showIndicator) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        transform: 'translateY(-50%)',
        zIndex: 'var(--z-layer-page-floating)',
        pointerEvents: 'auto',
      }}
    >
      <div className="scroll-slingshot" onClick={scrollToEnd} style={{ cursor: 'pointer' }}>
        <div className="flex items-center justify-center w-11 h-11 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-xl transition-colors duration-150 active:scale-95">
          <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ScrollableTableIndicator;
