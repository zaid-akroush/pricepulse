import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

// Branded placeholder shown while resolving / when everything fails.
function ImageFallback({ label = '', className = '' }) {
  const short = (label || '').trim().slice(0, 40);
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 p-3 text-center surface-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-sm shrink-0">
        <svg className="w-5 h-5 text-on-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" />
        </svg>
      </div>
      {short && (
        <span className="text-[11px] font-medium leading-tight text-muted line-clamp-2">{short}</span>
      )}
    </div>
  );
}

function proxied(url) {
  try {
    if (!url || url.startsWith('data:')) return null;
    const isHttps = /^https:/i.test(url);
    const stripped = url.replace(/^https?:\/\//i, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent((isHttps ? 'ssl:' : '') + stripped)}`;
  } catch {
    return null;
  }
}

function withProxy(url) {
  const out = [url];
  const p = proxied(url);
  if (p) out.push(p);
  return out;
}

const isPlaceholder = (u) => !u || u.startsWith('data:');

export default function ProductImage({ src, alt = '', className = '', fallbackClass = '', wrapperClass = '', productId }) {
  const buildChain = (s) => (s && !isPlaceholder(s) ? withProxy(s) : []);

  const [chain, setChain] = useState(() => buildChain(src));
  const [i, setI] = useState(0);
  const triedResolve = useRef(false);

  useEffect(() => {
    setChain(buildChain(src));
    setI(0);
    triedResolve.current = false;
  }, [src]);

  useEffect(() => {
    if (i < chain.length) return;
    if (!productId || triedResolve.current) return;
    triedResolve.current = true;
    let active = true;
    api.get(`/products/${productId}/og-image`)
      .then(r => {
        const url = r.data?.imageUrl;
        if (active && url) setChain(prev => [...prev, ...withProxy(url)]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [i, chain.length, productId]);

  const current = chain[i];

  let inner;
  if (current) {
    inner = (
      <img
        src={current}
        alt={alt}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setI(n => n + 1)}
      />
    );
  } else if (src && src.startsWith('data:')) {
    inner = <img src={src} alt={alt} className={className} loading="lazy" />;
  } else {
    inner = <ImageFallback label={alt} className={fallbackClass || className} />;
  }

  if (wrapperClass) return <div className={wrapperClass}>{inner}</div>;
  return inner;
}
