/**
 * Minimal Motion Presets
 * Following Rauno Freiberg's principle:
 * "Actions that are frequent and low in novelty should avoid extraneous animations"
 */

import { Variants } from 'framer-motion';

// Simple fade for state changes only
export const fadeIn: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// Fade and slight movement for content transitions
export const fadeInUp: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

// Simple scale for overlay content
export const fadeInScale: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15 },
  },
};

// Stagger for lists (minimal delay)
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.02,
    },
  },
};

// Stagger item
export const staggerItem: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
};

// Page transition (removed blur)
export const pageTransition = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.15,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

// REMOVED: All decorative animations
// - glowPulse
// - morphBlob
// - shimmer
// - bounce
// - typewriter
// - progressRing
// - buttonHover (with lift and shadow)
// These violate Rauno's principle of avoiding unnecessary decorations