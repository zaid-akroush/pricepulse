import { motion } from 'framer-motion';
import { spring } from './motion';

/**
 * DealScore: calculates how good a deal is based on how close the current
 * price is to the all-time low.
 *
 * Score / Grade:
 *   A+  : current price ≤ lowestPrice + 2%  → blazing deal
 *   A   : current is 90–95% of the range saved
 *   B   : good deal
 *   C   : average
 *   D   : barely a deal
 *   F   : at or near the peak
 */

/* Three status tiers, not a six-stop rainbow ramp: the letter grade itself
   carries the fine-grained meaning (A+ vs A), color only marks the broad
   band (good / fair / poor), and every render pairs color with the grade
   letter and label text — never color alone. */
const GRADES = [
  { min: 90, grade: 'A+', tier: 'success', label: 'Blazing Deal' },
  { min: 75, grade: 'A',  tier: 'success', label: 'Great Deal'  },
  { min: 55, grade: 'B',  tier: 'warning', label: 'Good Deal'   },
  { min: 35, grade: 'C',  tier: 'warning', label: 'Fair Deal'   },
  { min: 15, grade: 'D',  tier: 'danger',  label: 'Weak Deal'   },
  { min:  0, grade: 'F',  tier: 'danger',  label: 'Near Peak'   },
];

export function getDealScore(currentPrice, lowestPrice, highestPrice) {
  if (!highestPrice || highestPrice <= lowestPrice) return null;
  const range = highestPrice - lowestPrice;
  const saved = highestPrice - currentPrice;
  const score = Math.max(0, Math.min(100, Math.round((saved / range) * 100)));
  const info = GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];
  return { score, ...info };
}

export default function DealScore({ currentPrice, lowestPrice, highestPrice, size = 'md' }) {
  const info = getDealScore(currentPrice, lowestPrice, highestPrice);
  if (!info) return null;

  const isSmall = size === 'sm';

  return (
    <motion.span
      key={info.grade}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
      className={`inline-flex items-center gap-1 font-bold rounded-lg border ${isSmall ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1'}`}
      style={{
        color: `var(--${info.tier})`,
        backgroundColor: `var(--${info.tier}-soft)`,
        borderColor: `var(--${info.tier})`,
      }}
      title={`Deal Score: ${info.score}/100 (${info.label})`}
    >
      <span className={isSmall ? 'text-sm' : 'text-base'}>{info.grade}</span>
      {!isSmall && <span className="font-normal text-xs opacity-80">{info.label}</span>}
    </motion.span>
  );
}
