import { useState, useEffect } from 'react';
import { useEntity } from '../../contexts/EntityContext';
import { API_BASE } from '../../utils/api';
import { LucidePlus, LucideX, LucideWallet, Trash2, Edit3 } from 'lucide-react';
import { AssetManager } from './AssetManager';
import { CategoryManager } from './CategoryManager';

type Account = {
  id: string;
  name: string;
  type: string;
  entity: string;
  is_on_budget: boolean;
  starting_balance: number;
  credit_limit?: number;
  balance_tracking_method?: string;
  statement_date?: number;
  statement_due_days?: number;
};

export function SetupPanel({ onRefresh, baseCurrency = 'AUD', token }: { onRefresh: () => void, baseCurrency?: string, token: string | null }) {
  const { activeEntities } = useEntity();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Checking');
  const [newBalance, setNewBalance] = useState('0');
  const [newEntity, setNewEntity] = useState(Array.from(activeEntities)[0] || 'PERSONAL');
  const [isOnBudget, setIsOnBudget] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  // CC-specific fields
  const [creditLimit, setCreditLimit] = useState('');
  const [balanceTrackingMethod, setBalanceTrackingMethod] = useState('AMOUNT_OWING');
  const [statementDate, setStatementDate] = useState('');
  const [statementDueDays, setStatementDueDays] = useState('14');

  const fetchAccounts = async () => {
    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    const res = await fetch(`${API_BASE}/api/accounts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setAccounts(data);
  };

  useEffect(() => {
    if (token) fetchAccounts();
  }, [activeEntities, token]);

  const handleCreate = async () => {
    const isCC = newType === 'Credit Card';
    const payload: any = {
      name: newName,
      type: newType,
      entity: newEntity,
      is_on_budget: isOnBudget,
      starting_balance: parseFloat(newBalance),
      credit_limit: isCC && creditLimit ? parseFloat(creditLimit) : null,
      balance_tracking_method: isCC ? balanceTrackingMethod : null,
      statement_date: isCC && statementDate ? parseInt(statementDate) : null,
      statement_due_days: isCC && statementDueDays ? parseInt(statementDueDays) : null,
    };

    const url = editingId 
      ? `${API_BASE}/api/accounts/${editingId}`
      : `${API_BASE}/api/accounts`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowAdd(false);
      setEditingId(null);
      setNewName('');
      setNewBalance('0');
      fetchAccounts();
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this account and ALL its history? This cannot be undone.')) {
      const res = await fetch(`${API_BASE}/api/accounts/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAccounts();
        onRefresh();
      }
    }
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setNewName(acc.name);
    setNewType(acc.type);
    setNewBalance(acc.starting_balance.toString());
    setNewEntity(acc.entity as any);
    setIsOnBudget(acc.is_on_budget);
    setCreditLimit(acc.credit_limit?.toString() ?? '');
    setBalanceTrackingMethod(acc.balance_tracking_method ?? 'AMOUNT_OWING');
    setStatementDate(acc.statement_date?.toString() ?? '');
    setStatementDueDays(acc.statement_due_days?.toString() ?? '14');
    setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">{editingId ? 'Edit Account' : 'Accounts Setup'}</h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-full transition-colors"
        >
          {showAdd ? <LucideX className="w-4 h-4" /> : <LucidePlus className="w-4 h-4" />}
        </button>
      </div>

      {showAdd && (
        <div className="glass p-4 rounded-xl border border-blue-500/30 space-y-3 animate-in fade-in slide-in-from-top-2">
          <input 
            placeholder="Account Name (e.g. CBA Checking)" 
            value={newName} 
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
             <select value={newType} onChange={e => setNewType(e.target.value)} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="Checking">Checking</option>
                <option value="Savings">Savings</option>
                <option value="Credit Card">Credit Card</option>
             </select>
             <select value={newEntity} onChange={e => setNewEntity(e.target.value as any)} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
             </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                  <label className="text-[10px] text-slate-500 block mb-1">Starting Balance</label>
                  <input 
                      type="number" 
                      value={newBalance} 
                      onChange={e => setNewBalance(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
              </div>
              <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" checked={isOnBudget} onChange={e => setIsOnBudget(e.target.checked)} id="on-budget" />
                  <label htmlFor="on-budget" className="text-xs">On Budget</label>
              </div>
            </div>
            {newType === 'Credit Card' && (
              <div className="text-[10px] text-amber-500/80 italic px-1">
                {balanceTrackingMethod === 'AMOUNT_OWING' 
                  ? "→ Enter what you currently OWE (e.g. 1000 if you have a debt)." 
                  : "→ Enter your CURRENT AVAILABLE credit (e.g. 5000 if the card is empty)."}
              </div>
            )}
          </div>
          {newType === 'Credit Card' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 border-t border-white/10 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">Credit Card Settings</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Credit Limit</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={creditLimit}
                    onChange={e => setCreditLimit(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Balance Display</label>
                  <select
                    value={balanceTrackingMethod}
                    onChange={e => setBalanceTrackingMethod(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="AMOUNT_OWING">Amount Owing</option>
                    <option value="LIMIT_REMAINING">Limit Remaining</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Statement Closes (Day)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="e.g. 15"
                    value={statementDate}
                    onChange={e => setStatementDate(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Payment Due (Days After)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    placeholder="e.g. 14"
                    value={statementDueDays}
                    onChange={e => setStatementDueDays(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleCreate}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-sm transition-colors"
          >
            {editingId ? 'Update Account' : 'Create Account'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {accounts.map(acc => (
          <div key={acc.id} className={`p-4 rounded-xl border flex items-center justify-between ${acc.is_on_budget ? 'glass border-white/10' : 'bg-white/5 border-dashed border-white/20'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${acc.is_on_budget ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                <LucideWallet className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">{acc.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{acc.type} • {acc.is_on_budget ? 'Budgeted' : 'Withheld'}</div>
                {acc.type === 'Credit Card' && acc.credit_limit && (
                  <div className="text-[10px] text-amber-400 mt-0.5">
                    Limit: {acc.credit_limit.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}
                    {acc.statement_date ? ` · Stmt closes: ${acc.statement_date}th` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-bold text-sm">{acc.starting_balance.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}</div>
                <div className="text-[10px] text-slate-500">Starting</div>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button onClick={() => startEdit(acc)} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors">
                  <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm italic">
            No accounts configured. Start by adding one.
          </div>
        )}
      </div>

      <AssetManager onRefresh={onRefresh} baseCurrency={baseCurrency} token={token} />
      <CategoryManager token={token} />
    </div>
  );
}
