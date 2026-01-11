'use client';

import React, { useRef, useMemo } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type Align = 'left' | 'center' | 'right';
type Variant = 'default' | 'muted' | 'accent' | 'primary';

interface ScrollRevealProps {
  children: React.ReactNode;
  size?: Size;
  align?: Align;
  variant?: Variant;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  staggerDelay?: number;
  threshold?: number;
  duration?: number;
  springConfig?: {
    damping?: number;
    stiffness?: number;
    mass?: number;
  };
  containerClassName?: string;
  textClassName?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const alignClasses: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const variantClasses: Record<Variant, string> = {
  default: 'text-zinc-300/90',
  muted: 'text-zinc-400/80',
  accent: 'text-amber-300/90',
  primary: 'text-white',
};

export function ScrollReveal({
  children,
  size = 'lg',
  align = 'left',
  variant = 'default',
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  staggerDelay = 0.05,
  threshold = 0.5,
  duration = 0.8,
  springConfig = { damping: 25, stiffness: 100, mass: 1 },
  containerClassName = '',
  textClassName = '',
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, {
    once: false, // Re-animate when scrolling back up
    amount: threshold,
    margin: '0px 0px -50px 0px', // Trigger slightly before fully in view
  });

  // Convert children to string and split into words
  const text = useMemo(() => {
    if (typeof children === 'string') return children;
    // Handle React nodes by extracting text content
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (React.isValidElement(node) && node.props.children) {
        return extractText(node.props.children);
      }
      return '';
    };
    return extractText(children);
  }, [children]);

  const words = useMemo(() => text.split(' ').filter(Boolean), [text]);

  const wordVariants: Variants = {
    hidden: {
      opacity: baseOpacity,
      rotateX: baseRotation,
      filter: enableBlur ? `blur(${blurStrength}px)` : 'blur(0px)',
      y: 6,
      scale: 0.98,
    },
    visible: {
      opacity: 1,
      rotateX: 0,
      filter: 'blur(0px)',
      y: 0,
      scale: 1,
    },
  };

  return (
    <span
      ref={containerRef}
      className={`inline-block ${sizeClasses[size]} ${alignClasses[align]} ${variantClasses[variant]} ${containerClassName}`}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className={`inline-block mr-[0.25em] ${textClassName}`}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={wordVariants}
          transition={{
            type: 'spring',
            damping: springConfig.damping,
            stiffness: springConfig.stiffness,
            mass: springConfig.mass,
            duration,
            delay: isInView ? i * staggerDelay : 0, // Stagger only on reveal, instant on exit
          }}
          style={{
            transformOrigin: 'center bottom',
            willChange: 'opacity, filter, transform',
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export default ScrollReveal;
