import { useAuth } from '../context/AuthContext';

/* Shown next to a failure, but only to an admin.
 *
 * A normal visitor sees the short "couldn't load" message and nothing else.
 * Whoever runs the site needs more than that, so when the backend recognises
 * the cause it attaches a `diagnostic` block to the error response (see
 * backend services/diagnostics) — what broke, why, and the exact steps that
 * fix it. This renders that block so the answer appears where the failure
 * happened instead of only in the server log.
 *
 * Renders nothing when there's no diagnostic, which is the case for every
 * non-admin request, so it's safe to drop next to any error state.
 */
export default function AdminDiagnostic({ diagnostic }) {
  const { user } = useAuth();
  if (!diagnostic || !user) return null;

  return (
    <div
      className="rounded-xl border p-4 mt-3 text-left"
      style={{ borderColor: 'var(--danger)', backgroundColor: 'var(--danger-soft)' }}
      role="status"
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="badge badge-red text-[10px]">Admin diagnostic</span>
        <span className="text-[10px] font-data" style={{ color: 'var(--text-muted)' }}>{diagnostic.code}</span>
      </div>

      <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{diagnostic.title}</p>
      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>{diagnostic.detail}</p>

      {diagnostic.steps?.length > 0 && (
        <>
          <p className="text-[11px] font-bold mt-3 mb-1" style={{ color: 'var(--text)' }}>How to fix it</p>
          <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>
            {diagnostic.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
        </>
      )}

      {diagnostic.raw && (
        <p className="text-[10px] font-data mt-3 break-words" style={{ color: 'var(--text-muted)' }}>
          {diagnostic.context?.method} {diagnostic.context?.path} — {diagnostic.raw}
        </p>
      )}
    </div>
  );
}
