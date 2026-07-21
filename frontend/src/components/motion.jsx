import { motion } from 'framer-motion';

/* Shared motion primitives. Spring-physics based (per design system: no
   linear easing, weighty premium feel), isolated here so perpetual/entrance
   animation logic doesn't leak into every page. */

export const spring = { type: 'spring', stiffness: 100, damping: 20 };

/* Fades + rises an element in once, when it enters the viewport. */
export function FadeIn({ children, delay = 0, y = 16, className = '', as = 'div', once = true }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ ...spring, delay }}
    >
      {children}
    </MotionTag>
  );
}

/* Parent wrapper: staggers any <StaggerItem> children as they enter view. */
export function Stagger({ children, className = '', stagger = 0.08, as = 'div' }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({ children, className = '', y = 14, as = 'div' }) {
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: spring } }}
    >
      {children}
    </MotionTag>
  );
}
