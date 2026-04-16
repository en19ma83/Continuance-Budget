import { useState, useEffect } from 'react';
import { API_BASE } from './utils/api';
import { useTheme } from './contexts/ThemeContext';
import { useEntity } from './contexts/EntityContext';
import { RuleForm } from './components/RuleForm';
import { TimelineView } from './components/TimelineView';
import { CalendarView } from './components/CalendarView';
import { ReconciliationCenter } from './components/ReconciliationCenter';
import { ImportWizard } from './components/ImportWizard';
import { SetupPanel } from './components/setup/SetupPanel';
import { Login } from './components/Login';
import { CashFlowHorizons } from './components/CashFlowHorizons';
import { LucideGlobe, LucideLock, LucideTrendingUp, LucideNetwork, LucideLogOut } from 'lucide-react';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { activeEntities, toggleEntity } = useEntity();
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  
  const handleLogin = (newToken: string) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
  };
  
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [leftTab, setLeftTab] = useState<'rules' | 'reconcile' | 'setup'>('setup');
  const [stats, setStats] = useState<any>({ on_budget: 0, off_budget: 0, total: 0, assets_total: 0, liabilities_total: 0, equity_total: 0, net_worth: 0, base_currency: 'AUD' });
  const [baseCurrency, setBaseCurrency] = useState('AUD');
  const [isLoading, setIsLoading] = useState(true);
  const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'SGD'];

  const fetchStats = () => {
    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    params.append('base_currency', baseCurrency);
    fetch(`${API_BASE}/api/v2/stats?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => { if (res.status === 401) { handleLogout(); return null; } return res.json(); })
        .then(data => { if (data) { setStats(data); setIsLoading(false); } })
        .catch(() => setIsLoading(false));
  };

  const fetchLedger = () => {
    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    if (activeEntities.size === 0) {
        setLedgerEntries([]);
        return;
    }
    fetch(`${API_BASE}/api/ledger?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => { if (res.status === 401) { handleLogout(); return null; } return res.json(); })
        .then(data => { if (data) setLedgerEntries(data); })
        .catch(console.error);
  };

  useEffect(() => {
    if (token) {
        fetchLedger();
        fetchStats();
    }
  }, [activeEntities, baseCurrency, token]);

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1e1e1e] text-[#cccccc]' : 'bg-[#f3f3f3] text-[#333333]'} font-sans relative`}>
      {/* Background Gradient Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-blue-500/20 blur-3xl mix-blend-multiply opacity-70"></div>
        <div className="absolute top-[20%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-purple-500/20 blur-3xl mix-blend-multiply opacity-50"></div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
            <div className="text-sm text-slate-500 font-medium tracking-widest uppercase">Loading Continuance...</div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Options */}
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
            Continuance Finance
          </h1>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 glass px-2 py-1 rounded-full">
              <LucideGlobe className="w-3 h-3 text-slate-400" />
              <select
                value={baseCurrency}
                onChange={e => setBaseCurrency(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none cursor-pointer pr-1"
                title="Base Display Currency"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button 
              onClick={toggleTheme}
              className="px-4 py-2 rounded-full glass hover:bg-white/40 dark:hover:bg-black/50 transition-colors"
            >
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 rounded-full glass hover:bg-white/40 dark:hover:bg-black/50 transition-colors flex items-center gap-2 group"
              title="Logout"
            >
              <LucideLogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
            </button>
            <div className="glass flex rounded-full overflow-hidden p-1">
              <button 
                onClick={() => toggleEntity('PERSONAL')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeEntities.has('PERSONAL') ? 'bg-blue-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-black/10'}`}
              >
                Personal
              </button>
              <button 
                onClick={() => toggleEntity('BUSINESS')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeEntities.has('BUSINESS') ? 'bg-purple-500 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-black/10'}`}
              >
                Business
              </button>
            </div>
          </div>
        </header>

        {/* Liquidity Overview Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
           <div className="glass p-6 rounded-3xl border border-gray-200 dark:border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <LucideGlobe className="w-24 h-24" />
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Total Combined Liquidity <span className="text-blue-400">({baseCurrency})</span></div>
              <div className="text-4xl font-black">{stats.total.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
              <div className="mt-4 flex items-center gap-2 text-xs text-blue-400 font-semibold bg-blue-500/10 px-3 py-1 rounded-full w-fit">
                <LucideTrendingUp className="w-3 h-3" />
                Linked Across {activeEntities.size} Entities
              </div>
           </div>

           <div className="glass p-6 rounded-3xl border border-gray-200 dark:border-white/10 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Spendable Budget (On-Budget)</div>
              </div>
              <div className="text-2xl font-bold">{stats.on_budget.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
              <div className="text-[10px] text-slate-500 mt-1 italic">Liquid cash currently assigned to forcasting rules.</div>
           </div>

           <div className="glass p-6 rounded-3xl border border-gray-200 dark:border-white/10 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-1">
                <LucideLock className="w-3 h-3 text-amber-500" />
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Withheld Assets (Off-Budget)</div>
              </div>
              <div className="text-2xl font-bold">{stats.off_budget.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
              <div className="text-[10px] text-slate-500 mt-1 italic">Towed assets excluded from immediate spend reach.</div>
           </div>

           {(stats.assets_total > 0 || stats.liabilities_total > 0 || stats.equity_total > 0) && (
              <div className="glass p-6 rounded-3xl border border-purple-500/30 bg-purple-500/5 col-span-1 md:col-span-3 flex items-center justify-between animate-in zoom-in-95 duration-500 flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <LucideNetwork className="w-4 h-4 text-purple-400" />
                    <div className="text-xs font-bold uppercase tracking-widest text-purple-400">Net Worth Analysis</div>
                  </div>
                  <div className="text-4xl font-black text-gray-900 dark:text-white">{stats.net_worth.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
                </div>
                <div className="flex gap-8 text-right pr-4">
                   <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Liquid &amp; Gross Assets</div>
                      <div className="text-lg font-bold text-gray-700 dark:text-slate-300">{(stats.total + stats.assets_total).toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
                   </div>
                   {stats.equity_total > 0 && (
                   <div>
                      <div className="text-[10px] text-green-500/80 uppercase font-bold">Non-Liquid Equity</div>
                      <div className="text-lg font-bold text-green-400">{stats.equity_total.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
                   </div>
                   )}
                   <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Total Liabilities</div>
                      <div className="text-lg font-bold text-red-400/80">{(stats.liabilities_total).toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
                   </div>
                </div>
              </div>
           )}

           <CashFlowHorizons entries={ledgerEntries} baseCurrency={baseCurrency} />
        </section>

        {/* Dashboard Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-8">
            <div className="glass rounded-2xl p-6">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 mb-6 p-1 bg-gray-100 dark:bg-black/20">
                <button
                  onClick={() => setLeftTab('rules')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-md ${leftTab === 'rules' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                >
                  Rules
                </button>
                <button
                  onClick={() => setLeftTab('reconcile')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-md ${leftTab === 'reconcile' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                >
                  Reconcile
                </button>
                <button
                  onClick={() => setLeftTab('setup')}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-md ${leftTab === 'setup' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                >
                  Setup
                </button>
              </div>

              {leftTab === 'rules' ? (
                <>
                  <h2 className="text-xl font-semibold mb-2">Rule Engine</h2>
                  <p className="text-xs text-slate-500 mb-6">Define your recurring liquidity events.</p>
                  <RuleForm onComplete={fetchLedger} token={token} />
                </>
              ) : leftTab === 'reconcile' ? (
                <>
                  <h2 className="text-xl font-semibold mb-2">Statement Sync</h2>
                  <p className="text-xs text-slate-500 mb-6">Import statements and match to ghosts.</p>
                  <div className="space-y-8">
                    <ImportWizard onComplete={() => fetchLedger()} token={token} />
                    <ReconciliationCenter ghostEntries={ledgerEntries} onRefresh={fetchLedger} baseCurrency={baseCurrency} token={token} />
                  </div>
                </>
              ) : (
                <SetupPanel onRefresh={fetchLedger} baseCurrency={baseCurrency} token={token} />
              )}
            </div>
          </div>

          {/* Right Columns - Ledger & Timeline */}
          <div className="lg:col-span-2 glass rounded-2xl p-6 h-[800px] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Perpetual Ledger</h2>
                <div className="glass ml-4 flex rounded-full overflow-hidden p-1">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${viewMode === 'timeline' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow' : 'text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow' : 'text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                  >
                    Calendar
                  </button>
                </div>
              </div>
            </div>

            <div className="relative">
              {viewMode === 'timeline' ? (
                <TimelineView entries={ledgerEntries} baseCurrency={baseCurrency} token={token} onRefresh={fetchLedger} />
              ) : (
                <CalendarView entries={ledgerEntries} baseCurrency={baseCurrency} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App;
