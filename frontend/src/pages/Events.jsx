import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const EventIcon = {
  bag: (p) => <svg {...iconProps} {...p}><path d="M6 8h12l1 13H5L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  laptop: (p) => <svg {...iconProps} {...p}><rect x="4" y="4" width="16" height="11" rx="1.5" /><path d="M2 18h20" /></svg>,
  bolt: (p) => <svg {...iconProps} fill="currentColor" stroke="none" {...p}><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" /></svg>,
  backpack: (p) => <svg {...iconProps} {...p}><path d="M7 8a5 5 0 0 1 10 0v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8z" /><path d="M9 12h6M10 5v3M14 5v3" /></svg>,
  gift: (p) => <svg {...iconProps} {...p}><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 13h16M12 9v11" /><path d="M8 9a2.5 2.5 0 1 1 4-3 2.5 2.5 0 1 1 4 3" /></svg>,
  bulb: (p) => <svg {...iconProps} {...p}><path d="M9 18h6M10 22h4" /><path d="M12 2a6 6 0 0 0-4 10.5c.6.5 1 1.3 1 2.5h6c0-1.2.4-2 1-2.5A6 6 0 0 0 12 2z" /></svg>,
};

const EVENTS = [
  {
    id: 1,
    name: 'Black Friday 2026',
    date: 'November 27, 2026',
    daysUntil: Math.ceil((new Date('2026-11-27') - new Date()) / 86400000),
    icon: 'bag',
    description: 'The biggest shopping day of the year. Electronics, appliances, and everything else.',
    categories: ['Laptops', 'TVs', 'Gaming', 'Phones', 'Headphones'],
    tipTitle: 'Pro tip',
    tip: 'Add items to your wishlist now and set target prices. We\'ll alert you the moment prices drop on Black Friday.',
  },
  {
    id: 2,
    name: 'Cyber Monday',
    date: 'December 1, 2026',
    daysUntil: Math.ceil((new Date('2026-12-01') - new Date()) / 86400000),
    icon: 'laptop',
    description: 'Online-exclusive deals, often better than Black Friday for tech.',
    categories: ['Laptops', 'Software', 'Smart Home', 'Gaming', 'Accessories'],
    tipTitle: 'Did you know?',
    tip: 'Cyber Monday typically has deeper discounts on computers and peripherals than Black Friday.',
  },
  {
    id: 3,
    name: 'Amazon Prime Day',
    date: 'July 2026 (dates TBA)',
    daysUntil: null,
    icon: 'bolt',
    description: 'Amazon\'s annual members-only mega-sale. Non-members still see deals elsewhere.',
    categories: ['Echo/Alexa', 'Fire TV', 'Laptops', 'Phones', 'Kitchen'],
    tipTitle: 'Insider tip',
    tip: 'Competing retailers like Best Buy and Walmart run simultaneous deals to match Amazon. Track prices across stores.',
  },
  {
    id: 4,
    name: 'Back to School',
    date: 'August-September 2026',
    daysUntil: null,
    icon: 'backpack',
    description: 'Great time to buy laptops, tablets, monitors, and accessories.',
    categories: ['Laptops', 'iPads', 'Monitors', 'Headphones', 'Keyboards'],
    tipTitle: 'Student discount',
    tip: 'Apple, Dell, and Lenovo offer student discounts on top of sale prices during back-to-school season.',
  },
  {
    id: 5,
    name: 'Holiday Season',
    date: 'December 2026',
    daysUntil: Math.ceil((new Date('2026-12-20') - new Date()) / 86400000),
    icon: 'gift',
    description: 'Gift-giving deals throughout December. Great for gaming consoles and bundles.',
    categories: ['Gaming Consoles', 'Smart Speakers', 'Drones', 'Cameras', 'Wearables'],
    tipTitle: 'Gift buying tip',
    tip: 'Prices peak right before Christmas. Shop early December for the best deals on popular gifts.',
  },
];

const SEARCH_SUGGESTIONS = [
  { label: 'Black Friday Laptops', q: 'laptop' },
  { label: 'Gaming Console Deals', q: 'gaming console' },
  { label: 'TV Sales', q: '4K TV' },
  { label: 'Headphone Deals', q: 'noise cancelling headphones' },
  { label: 'Phone Discounts', q: 'flagship phone' },
  { label: 'Monitor Deals', q: 'gaming monitor 27 inch' },
  { label: 'Smart Home', q: 'smart speaker' },
  { label: 'Camera Deals', q: 'mirrorless camera' },
];

export default function Events() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <PageHeader
        eyebrow="Timing"
        title="Deals & Sale Events"
        subtitle="Track upcoming sale events and know exactly when to buy. Add items to your wishlist now to get alerted the moment prices drop."
        className="mb-8"
      />

      {/* Countdown to Black Friday */}
      {(() => {
        const bf = EVENTS[0];
        return (
          <div className="rounded-2xl bg-brand p-6 mb-8 text-on-brand">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                {EventIcon[bf.icon]({ className: 'w-7 h-7' })}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{bf.name}</h2>
                <p className="text-sm mt-1 opacity-80">{bf.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {bf.categories.map(c => (
                    <button key={c} onClick={() => navigate(`/search?q=${encodeURIComponent(c)}`)}
                      className="text-xs bg-black/10 hover:bg-black/20 px-3 py-1 rounded-full font-medium transition-colors">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {bf.daysUntil > 0 && (
                <div className="text-center bg-black/10 rounded-2xl px-8 py-5 border border-current/20 shrink-0">
                  <p className="text-4xl font-bold font-data">{bf.daysUntil}</p>
                  <p className="text-sm font-medium opacity-70">days away</p>
                  <p className="text-xs mt-1 opacity-50">{bf.date}</p>
                </div>
              )}
            </div>
            <div className="mt-4 bg-black/10 rounded-xl px-4 py-3 text-sm border border-current/20 opacity-90">
              <strong>{bf.tipTitle}:</strong> {bf.tip}
            </div>
          </div>
        );
      })()}

      {/* Event grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {EVENTS.slice(1).map(event => (
          <div key={event.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  {EventIcon[event.icon]({ className: 'w-5 h-5' })}
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{event.name}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.date}</p>
                </div>
              </div>
              {event.daysUntil > 0 && (
                <div className="text-center bg-brand-soft text-brand rounded-xl px-3 py-2 shrink-0">
                  <p className="text-xl font-bold font-data leading-none">{event.daysUntil}</p>
                  <p className="text-[10px] font-medium">days</p>
                </div>
              )}
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{event.description}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {event.categories.map(c => (
                <button key={c} onClick={() => navigate(`/search?q=${encodeURIComponent(c)}`)}
                  className="chip">
                  {c}
                </button>
              ))}
            </div>
            <p className="text-xs p-3 rounded-lg flex items-start gap-2" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
              <span className="text-brand shrink-0 mt-0.5">{EventIcon.bulb({ className: 'w-3.5 h-3.5' })}</span>
              <span><strong>{event.tipTitle}:</strong> {event.tip}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Quick search section */}
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>
          Start tracking deals now
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Search for products today and add them to your wishlist. We'll alert you when prices drop for any upcoming sale event.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SEARCH_SUGGESTIONS.map(s => (
            <button key={s.label} onClick={() => navigate(`/search?q=${encodeURIComponent(s.q)}`)}
              className="w-full text-xs text-left p-3 rounded-xl border transition-colors font-medium hover:border-brand hover:text-brand"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
