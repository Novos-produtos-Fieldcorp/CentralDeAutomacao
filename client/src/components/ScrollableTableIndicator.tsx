import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ScrollableTableIndicatorProps {
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

const ScrollableTableIndicator: React.FC<ScrollableTableIndicatorProps> = ({
  containerRef,
  className = ''
}) => {
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [containerBounds, setContainerBounds] = useState<{ left: number; right: number } | null>(null);

  const updateAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftIndicator(scrollLeft > 0);
    setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 1);

    const rect = container.getBoundingClientRect();
    setContainerBounds({ left: rect.left, right: rect.right });

    const viewportHeight = window.innerHeight;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);

    if (visibleBottom > visibleTop) {
      setIndicatorTop((visibleTop + visibleBottom) / 2);
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

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const buttonClass =
    'flex items-center justify-center w-11 h-11 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-xl transition-all duration-150 active:scale-95';

  return (
    <>
      {showLeftIndicator && containerBounds && (
        <div
          style={{
            position: 'fixed',
            top: indicatorTop,
            left: containerBounds.left + 8,
            transform: 'translateY(-50%)',
            zIndex: 50,
          }}
          onClick={scrollLeft}
        >
          <div className={buttonClass}>
            <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
        </div>
      )}
      {showRightIndicator && containerBounds && (
        <div
          style={{
            position: 'fixed',
            top: indicatorTop,
            left: containerBounds.right - 52,
            transform: 'translateY(-50%)',
            zIndex: 50,
          }}
          onClick={scrollRight}
        >
          <div className={buttonClass}>
            <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
        </div>
      )}
    </>
  );
};

export default ScrollableTableIndicator;
