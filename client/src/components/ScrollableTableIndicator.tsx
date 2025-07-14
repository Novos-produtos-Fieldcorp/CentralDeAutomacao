import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftIndicator(scrollLeft > 0);
      setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 1); // -1 for rounding errors
    };

    // Initial check
    checkScroll();

    // Add event listener
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    // Cleanup
    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [containerRef]);

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <>
      {showLeftIndicator && (
        <div 
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-10 ${className}`}
          onClick={scrollLeft}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
        </div>
      )}
      {showRightIndicator && (
        <div 
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 ${className}`}
          onClick={scrollRight}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
        </div>
      )}
    </>
  );
};

export default ScrollableTableIndicator;