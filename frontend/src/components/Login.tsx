import { useState } from 'react';
import { LucideLock, LucideUser, LucideWallet, LucideMail, LucideCheck, LucideX } from 'lucide-react';
import { API_BASE } from '../utils/api';

type Mode = 'login' | 'register';

interface PasswordRule {
    label: string;
    test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
    { label: '8–16 characters', test: p => p.length >= 8 && p.length <= 16 },
    { label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
    { label: 'Lowercase letter', test: p => /[a-z]/.test(p) },
    { label: 'Number', test: p => /\d/.test(p) },
    { label: 'Special character', test: p => /[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?/`~\\]/.test(p) },
];

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
    const [mode, setMode] = useState<Mode>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [registered, setRegistered] = useState(false);

    const passwordValid = PASSWORD_RULES.every(r => r.test(password));
    const showPasswordRules = mode === 'register' && password.length > 0;

    const reset = (nextMode: Mode) => {
        setMode(nextMode);
        setError('');
        setPassword('');
        setEmail('');
        setRegistered(false);
    };

    const handleLogin = async () => {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', body: formData });
        if (res.ok) {
            const data = await res.json();
            onLogin(data.access_token);
        } else {
            setError('Invalid username or password');
        }
    };

    const handleRegister = async () => {
        if (!passwordValid) {
            setError('Password does not meet requirements');
            return;
        }
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email: email || undefined, password }),
        });
        if (res.status === 201) {
            setRegistered(true);
            setError('');
        } else {
            const data = await res.json().catch(() => ({}));
            setError(data.detail || 'Registration failed');
        }
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            if (mode === 'login') await handleLogin();
            else await handleRegister();
        } catch {
            setError('System unavailable. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0f] text-gray-900 dark:text-white flex items-center justify-center p-6 selection:bg-purple-500/30">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
                <div className="glass p-8 rounded-[40px] border border-gray-200 dark:border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 mb-6 shadow-lg shadow-purple-500/20">
                            <LucideWallet className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            Continuance
                        </h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium tracking-wide">PERPETUAL FORECASTING ENGINE</p>
                    </div>

                    {/* Mode tabs */}
                    <div className="flex bg-gray-200 dark:bg-black/30 rounded-2xl p-1 mb-6">
                        {(['login', 'register'] as Mode[]).map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => reset(m)}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                                    mode === m
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Register'}
                            </button>
                        ))}
                    </div>

                    {registered ? (
                        <div className="text-center py-6 space-y-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30">
                                <LucideCheck className="w-6 h-6 text-green-400" />
                            </div>
                            <p className="text-white font-semibold">Account created!</p>
                            <p className="text-slate-400 text-sm">You can now sign in with your credentials.</p>
                            <button
                                type="button"
                                onClick={() => reset('login')}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-2xl"
                            >
                                Go to Sign In
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Username */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
                                    Username
                                </label>
                                <div className="relative group">
                                    <LucideUser className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="Username"
                                        required
                                        className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Email (register only) */}
                            {mode === 'register' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
                                        Email <span className="text-slate-600">(optional)</span>
                                    </label>
                                    <div className="relative group">
                                        <LucideMail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
                                    {mode === 'login' ? 'Access Key' : 'Password'}
                                </label>
                                <div className="relative group">
                                    <LucideLock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-medium placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            {/* Password rules (register only) */}
                            {showPasswordRules && (
                                <div className="bg-gray-100 dark:bg-black/30 rounded-2xl p-4 space-y-1.5">
                                    {PASSWORD_RULES.map(rule => {
                                        const ok = rule.test(password);
                                        return (
                                            <div key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                                                {ok
                                                    ? <LucideCheck className="w-3 h-3 flex-shrink-0" />
                                                    : <LucideX className="w-3 h-3 flex-shrink-0" />
                                                }
                                                {rule.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs py-3 px-4 rounded-xl">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || (mode === 'register' && !passwordValid)}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : mode === 'login' ? (
                                    <>Enter Dashboard <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /></>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-slate-700 text-[10px] mt-8 font-bold tracking-[0.3em] uppercase">
                    &copy; 2026 Continuance Finance
                </p>
            </div>
        </div>
    );
}
