/**
 * Shared framer-motion primitives used across the site.
 * MotionConfig (in main.jsx) sets reducedMotion="user", so every effect here
 * automatically respects the OS "reduce motion" preference.
 */
import { motion, useScroll, useSpring } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const heroItem = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  header: motion.header,
  ul: motion.ul,
  li: motion.li,
};

/**
 * Reading-progress bar pinned under the header.
 *
 * Scroll position is driven by a spring rather than the raw value, so the bar
 * glides instead of jittering on trackpads. It collapses to a hairline when
 * the page doesn't scroll and is hidden entirely for reduced-motion users
 * (MotionConfig handles that automatically).
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-brand-500 via-clay-400 to-evergreen-500"
      style={{ scaleX: width }}
    />
  );
}

/**
 * Scroll-triggered reveal: fades/slides children in the first time they enter
 * the viewport, then stays put (`once: true`).
 */
export function Reveal({ children, className, delay = 0, y = 22, as = 'div', amount = 'some', ...rest }) {
  const Comp = TAGS[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Parent that staggers its StaggerItem children into view. */
export function Stagger({ children, className, delay = 0, amount = 'some', as = 'div' }) {
  const Comp = TAGS[as] || motion.div;
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}
    >
      {children}
    </Comp>
  );
}

/** Child of <Stagger/> — inherits the parent's reveal timing. */
export function StaggerItem({ children, className, as = 'div' }) {
  const Comp = TAGS[as] || motion.div;
  return (
    <Comp className={className} variants={fadeUp}>
      {children}
    </Comp>
  );
}

/**
 * Sticky section header used by the account-style pages: the eyebrow and title
 * slide in together instead of arriving as one flat block.
 */
export function PageHead({ eyebrow, title, description, actions, className = '' }) {
  return (
    <Reveal className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </Reveal>
  );
}
