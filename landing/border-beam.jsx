// Magic UI BorderBeam (MIT), adapted off Tailwind.
// https://github.com/magicuidesign/magicui
import { motion } from 'motion/react';

export function BorderBeam({
  size = 80,
  delay = 0,
  duration = 8,
  colorFrom = 'var(--tide-accent)',
  colorTo = 'var(--lagoon)',
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5,
}) {
  return (
    <div
      className="border-beam"
      style={{ '--border-beam-width': `${borderWidth}px` }}
    >
      <motion.div
        className="border-beam-light"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  );
}
