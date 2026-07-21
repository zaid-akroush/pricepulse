import { useEffect, useState } from 'react';
import { pushSupported, getPushState, enablePush, disablePush } from '../utils/push';

export default function PushToggle() {
  const [state, setState] = useState({ supported: true, subscribed: false, permission: 'default' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pushSupported()) { setState({ supported: false, subscribed: false, permission: 'unsupported' }); return; }
    getPushState().then(setState).catch(() => {});
  }, []);

  if (!state.supported) return null;

  async function toggle() {
    setBusy(true); setError('');
    try {
      if (state.subscribed) await disablePush();
      else await enablePush();
      setState(await getPushState());
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally { setBusy(false); }
  }

  const on = state.subscribed;
  return (
    <div className="card p-4 mb-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-purple-soft text-purple flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Browser push alerts</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {on ? 'On: you’ll get a notification even when PricePulse is closed.' : 'Get price-drop alerts pushed to this device.'}
        </p>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 w-12 h-7 rounded-full relative transition-colors disabled:opacity-50 ${on ? 'bg-success' : 'surface-3'}`}
        aria-pressed={on}
        title={on ? 'Disable push' : 'Enable push'}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-all ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}
