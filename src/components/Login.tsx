import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { isAxiosError } from 'axios';
import api from '../services/api';
import { useAuth } from '../contexts/authContextValue';
import { useToast } from '../contexts/toastContextValue';

type AccountOption = {
  accountId: string;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.post('/auth/login', {
        email,
        password,
        accountId: accountId || undefined,
      });
      login(response.data.token, response.data.client);
      setAccountOptions([]);
      toast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err: unknown) {
      const responseData = isAxiosError<{
        error?: string;
        code?: string;
        accounts?: AccountOption[];
      }>(err)
        ? err.response?.data
        : undefined;
      if (responseData?.code === 'ACCOUNT_SELECTION_REQUIRED' && responseData.accounts?.length) {
        setAccountOptions(responseData.accounts);
        setAccountId(responseData.accounts[0].accountId);
        toast(responseData.error || 'Select a workspace to continue.', 'error');
        return;
      }

      const message = responseData?.error;
      toast(message || 'Invalid credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-shell py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white/90 backdrop-blur p-8 rounded-3xl shadow-lg border border-[color:var(--border)]">
        <div>
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-[color:var(--bg-soft)] text-[color:var(--brand)] shadow-sm">
            <LogIn className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-center font-display text-3xl font-semibold text-[color:var(--ink)]">
            Client Portal
          </h2>
          <p className="mt-2 text-center text-sm text-[color:var(--muted)]">
            Sign in to view your projects
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                className="block w-full px-4 py-3 border border-[color:var(--border)] rounded-xl text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-transparent transition"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                className="block w-full px-4 py-3 border border-[color:var(--border)] rounded-xl text-sm text-[color:var(--ink)] placeholder-[color:var(--muted)] bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-transparent transition"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {accountOptions.length > 0 && (
              <div>
                <label htmlFor="login-account" className="block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] mb-1.5">
                  Workspace
                </label>
                <select
                  id="login-account"
                  required
                  className="block w-full px-4 py-3 border border-[color:var(--border)] rounded-xl text-sm text-[color:var(--ink)] bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-transparent transition"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accountOptions.map((option) => (
                    <option key={option.accountId} value={option.accountId}>
                      monday account {option.accountId}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl text-white bg-[color:var(--brand)] hover:bg-[color:var(--brand-strong)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[color:var(--brand)] transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
