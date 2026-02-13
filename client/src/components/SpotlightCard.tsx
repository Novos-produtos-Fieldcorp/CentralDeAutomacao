import React, { useRef } from 'react';
import './SpotlightCard.css';

type SpotlightColor = `rgba(${number}, ${number}, ${number}, ${number})`;

type SpotlightCardProps<T extends React.ElementType> = React.PropsWithChildren<{
  as?: T;
  className?: string;
  spotlightColor?: SpotlightColor;
}> &
  Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'onMouseMove'>;

const SpotlightCard = React.forwardRef(
  <T extends React.ElementType = 'div'>(
    {
      as,
      children,
      className = '',
      spotlightColor,
      ...rest
    }: SpotlightCardProps<T>,
    ref: React.ForwardedRef<HTMLElement>
  ) => {
    const localRef = useRef<HTMLElement | null>(null);

    const setRefs = (node: HTMLElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const Component = (as || 'div') as React.ElementType;

    const handleMouseMove: React.MouseEventHandler<HTMLElement> = e => {
      const el = localRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      el.style.setProperty('--mouse-x', `${x}px`);
      el.style.setProperty('--mouse-y', `${y}px`);
      if (spotlightColor) {
        el.style.setProperty('--spotlight-color', spotlightColor);
      }
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
