import { FadeIn } from './motion';

/* Shared left-aligned page header: eyebrow + heading + subtitle, used
   across app pages so headings read consistently instead of ad-hoc
   heading classes scattered per page. */
export default function PageHeader({ eyebrow, title, subtitle, action, className = '' }) {
  return (
    <FadeIn className={`flex items-end justify-between gap-4 flex-wrap ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold text-app tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1.5 text-sm max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </FadeIn>
  );
}
