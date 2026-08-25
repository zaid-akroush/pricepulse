/* Shared layout primitives.
 *
 * These used to be framer-motion scroll/entrance animations (fade + rise on
 * whileInView, staggered children). They were removed: on route changes and
 * while scrolling up and down, elements re-evaluated their viewport state and
 * flickered / re-played, and content briefly rendered invisible. They now
 * render as plain elements with the same API and class names, so every call
 * site keeps working unchanged and content is visible immediately.
 *
 * The `delay`, `y`, `once` and `stagger` props are still accepted and ignored
 * on purpose, so nothing has to change at the call sites.
 */

export const spring = { type: 'spring', stiffness: 100, damping: 20 };

export function FadeIn({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={className}>{children}</Tag>;
}

export function Stagger({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={className}>{children}</Tag>;
}

export function StaggerItem({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={className}>{children}</Tag>;
}
