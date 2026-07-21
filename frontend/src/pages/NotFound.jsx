import { Link, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="text-3xl font-bold text-app tracking-tight mb-3">Page not found</h1>
      <p className="text-muted mb-8">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={() => navigate(-1)} className="btn-secondary">← Go back</button>
        <Link to="/" className="btn-primary">Back to home</Link>
      </div>
    </div>
  );
}
