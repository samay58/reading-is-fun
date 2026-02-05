/**
 * Motion Configuration - Minimal Linear/Vercel style
 * Subtle opacity transitions and small Y transforms only
 */

import type { Variants } from 'framer-motion';

// Timing
export const DURATION = 0.2;
export const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

// Default transition
export const transition = { duration: DURATION, ease: EASE };

// Simple fade
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition },
  exit: { opacity: 0, transition },
};

// Fade with subtle upward movement
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: -4, transition },
};

// Scale in (for overlays)
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition },
  exit: { opacity: 0, scale: 0.98, transition },
};

// Stagger container
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Stagger item
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition },
};

// Check reduced motion preference
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
