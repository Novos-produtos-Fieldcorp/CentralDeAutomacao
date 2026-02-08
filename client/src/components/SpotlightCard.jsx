import React, { useRef } from 'react';
import './SpotlightCard.css';

const SpotlightCard = React.forwardRef(
  (
    {
      as: Component = 'div',
      children,
      className = '',
      spotlightColor = 'rgba(255, 255, 255, 0.25)',
      onMouseMove,
      ...rest
    },
    ref
  ) => {
    const localRef = useRef(null);

    const setRefs = node => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const handleMouseMove = e => {
      if (typeof onMouseMove === 'function') onMouseMove(e);
      if (!localRef.current) return;

      const rect = localRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      localRef.current.style.setProperty('--mouse-x', `${x}px`);
      localRef.current.style.setProperty('--mouse-y', `${y}px`);
      localRef.current.style.setProperty('--spotlight-color', spotlightColor);
    };

    return (
      <Component
        ref={setRefs}
        onMouseMove={handleMouseMove}
        className={`card-spotlight ${className}`}
        {...rest}
      >
        {children}
      </Component>
    );
  }
);

SpotlightCard.displayName = 'SpotlightCard';

export default SpotlightCard;
