'use client';

import { useState, useRef, useCallback } from 'react';

interface UseDelayedTooltipOptions {
  /**
   * Delay in ms before showing tooltip
   * Default: 150 (Rauno's invisible details principle)
   */
  delay?: number;

  /**
   * Delay in ms before hiding tooltip after mouse leave
   * Default: 0 (instant hide)
   */
  hideDelay?: number;
}

interface TooltipState {
  isVisible: boolean;
  x: number;
  y: number;
}

/**
 * useDelayedTooltip - Show tooltip with intentional delay
 *
 * Following Rauno's "Invisible Details" principle:
 * "A tooltip that shows after 150ms on hover feels more intentional"
 *
 * @example
 * ```tsx
 * const { isVisible, x, y, handlers } = useDelayedTooltip();
 *
 * return (
 *   <div {...handlers}>
 *     Hover me
 *     {isVisible && (
 *       <Tooltip style={{ left: x, top: y }}>
 *         Helpful text
 *       </Tooltip>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useDelayedTooltip(options: UseDelayedTooltipOptions = {}) {
  const { delay = 150, hideDelay = 0 } = options;

  const [state, setState] = useState<TooltipState>({
    isVisible: false,
    x: 0,
    y: 0,
  });

  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent) => {
      clearTimeouts();

      // Store initial position
      lastPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      // Show after delay
      showTimeoutRef.current = setTimeout(() => {
        setState({
          isVisible: true,
          x: lastPositionRef.current.x,
          y: lastPositionRef.current.y,
        });
      }, delay);
    },
    [delay, clearTimeouts]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    // Update position for when tooltip shows
    lastPositionRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    // If already visible, update position
    setState((prev) => {
      if (prev.isVisible) {
        return {
          ...prev,
          x: event.clientX,
          y: event.clientY,
        };
      }
      return prev;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeouts();

    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, isVisible: false }));
      }, hideDelay);
    } else {
      setState((prev) => ({ ...prev, isVisible: false }));
    }
  }, [hideDelay, clearTimeouts]);

  const show = useCallback(() => {
    clearTimeouts();
    setState((prev) => ({ ...prev, isVisible: true }));
  }, [clearTimeouts]);

  const hide = useCallback(() => {
    clearTimeouts();
    setState((prev) => ({ ...prev, isVisible: false }));
  }, [clearTimeouts]);

  return {
    isVisible: state.isVisible,
    x: state.x,
    y: state.y,
    show,
    hide,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}

export default useDelayedTooltip;
