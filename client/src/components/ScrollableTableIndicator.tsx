import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';

interface ScrollableTableIndicatorProps {
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

const ScrollableTableIndicator: React.FC<ScrollableTableIndicatorProps> = ({
  containerRef,
}) => {
  const [showRightIndicator, setShowRightIndicator] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [containerRight, setContainerRight] = useState(0);

  const updateAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 1);

    const rect = container.getBoundingClientRect();
    setContainerRight(rect.right);

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

  const scrollToEnd = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: containerRef.current.scrollWidth, behavior: 'smooth' });
    }
  };

  if (!showRightIndicator) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: indicatorTop,
        left: containerRight - 52,
        transform: 'translateY(-50%)',
        zIndex: 50,
      }}
      onClick={scrollToEnd}
    >
      <div className="flex items-center justify-center w-11 h-11 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-xl transition-all duration-150 active:scale-95">
        <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </div>
    </div>
  );
};

export default ScrollableTableIndicator;
