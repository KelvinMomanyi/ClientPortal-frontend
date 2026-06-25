import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../contexts/authContextValue';
import { useToast } from '../contexts/toastContextValue';

type InviteClient = {
  name: string;
  email: string;
};

type InviteResponse = {
  client: InviteClient;
  expiresAt: number;
};

export default function ActivateInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [client, setClient] = useState<InviteClient | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError('Invite link is missing a token');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<InviteResponse>(`/auth/invites/${token}`);
        setClient(response.data.client);
        setExpiresAt(response.data.expiresAt);
      } catch (err: unknown) {
        const message = isAxiosError<{ error?: string }>(err)
          ? err.response?.data?.error
          : undefined;
        setError(message || 'Invite link is invalid or expired');
      } finally {
        setLoading(false);
      }
    }

    void loadInvite();
  }, [token]);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await api.post(`/auth/invites/${token}/activate`, { password });
      login(response.data.token, response.data.client);
      toast('Portal access activated', 'success');
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error
        : undefined;
      setError(message || 'Failed to activate invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-shell py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur p-8 rounded-3xl shadow-lg border border-[color:var(--border)]">
        <div>
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-[color:var(--bg-soft)] text-[color:var(--brand)] shadow-sm">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-center font-display text-3xl font-semibold text-[color:var(--ink)]">
            Activate Portal Access
          </h2>
          <p className="mt-2 text-center text-sm text-[color:var(--muted)]">
            {client ? client.email : 'Set up your client portal password'}
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[color:var(--muted)]">Loading invite...</div>
        ) : error && !client ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
            <Link
              to="/login"
              className="block w-full rounded-xl border border-[color:var(--border)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-soft)]"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={activate}>
            {client && (
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-soft)] px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--ink)]">{client.name}</p>
                <p className="text-xs text-[color:var(--muted)]">{client.email}</p>
                {expiresAt && (
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    Invite expires {new Date(expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="activate-password" className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] mb-1.5">
                  Password
                </label>
                <input
                  id="activate-password"
                  type="password"
                  required
                  minLength={8}
                  className="block w-full px-4 py-3 border border-[color:var(--border)] rounded-xl text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-transparent transition"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="activate-confirm-password" className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="activate-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  className="block w-full px-4 py-3 border border-[color:var(--border)] rounded-xl text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-transparent transition"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl text-white bg-[color:var(--brand)] hover:bg-[color:var(--brand-strong)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--brand)] transition duration-200 disabled:opacity-50"
            >
              {submitting ? 'Activating...' : 'Activate Access'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
