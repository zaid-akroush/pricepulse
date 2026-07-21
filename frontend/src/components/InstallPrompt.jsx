import { useEffect, useState } from 'react';
import Logo from './Logo';

// Lightweight "Add to home screen" banner driven by the beforeinstallprompt event.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setDeferred(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred || hidden) return null;

  async function install() {
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) {}
    setDeferred(null);
  }

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:w-80 z-50">
      <div className="card p-4 flex items-center gap-3 shadow-lg border-app">
        <Logo className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Install PricePulse</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add the app for instant price alerts.</p>
        </div>
        <button onClick={install} className="btn-primary text-xs px-3 py-2 shrink-0">Install</button>
        <button onClick={() => setHidden(true)} className="text-muted hover:text-app text-lg leading-none shrink-0" title="Dismiss" aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}
