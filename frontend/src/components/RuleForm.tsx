import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useEntity } from '../contexts/EntityContext';
import { LucideCalendar } from 'lucide-react';

type CategoryType = { id: string, name: string, color: string };
type CategoryGroupType = { id: string, name: string, type: string, categories: CategoryType[] };

export function RuleForm({ onComplete, token }: { onComplete?: () => void, token: string | null }) {
  const { activeEntities } = useEntity();
  const defaultEntity = activeEntities.size > 0 ? Array.from(activeEntities)[0] : 'PERSONAL';

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequencyType, setFrequencyType] = useState('MONTHLY_DATE');
  const [frequencyValue, setFrequencyValue] = useState<string>('1');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTaxEvent, setIsTaxEvent] = useState(false);
  const [entity, setEntity] = useState(defaultEntity);
  const [categoryId, setCategoryId] = useState<string>('');

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroupType[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  
  const [assets, setAssets] = useState<any[]>([]);
  const [assetId, setAssetId] = useState<string>('');

  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };

    fetch(`${API_BASE}/api/categories/groups`, { headers })
      .then(res => res.json())
      .then(data => setCategoryGroups(data))
      .catch(console.error);

    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    fetch(`${API_BASE}/api/accounts?${params.toString()}`, { headers })
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        if (data.length > 0) setAccountId(data[0].id);
      })
      .catch(console.error);

    fetch(`${API_BASE}/api/assets?${params.toString()}`, { headers })
      .then(res => res.json())
      .then(data => setAssets(data))
      .catch(console.error);
  }, [activeEntities, token]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const selectedGroup = categoryGroups.find(g => g.categories.some(c => c.id === categoryId));
    const isExpense = selectedGroup?.type === 'EXPENSE';

    const payload = {
      name,
      amount: isExpense ? -Math.abs(parseFloat(amount)) : parseFloat(amount),
      frequency_type: frequencyType,
      frequency_value: frequencyType === 'MONTHLY_DATE' ? parseInt(frequencyValue) : null,
      anchor_date: anchorDate,
      is_tax_deductible: isTaxEvent,
      entity: entity,
      category_id: categoryId || null,
      account_id: accountId || null,
      transfer_to_account_id: isTransfer ? targetAccountId : null,
      asset_id: assetId || null
    };

    try {
      const resp = await fetch(`${API_BASE}/api/rules`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        setName('');
        setAmount('');
        setCategoryId('');
        setAssetId('');
        setIsTransfer(false);
        setTargetAccountId('');
        setFrequencyType('MONTHLY_DATE');
        setFrequencyValue('1');
        setIsTaxEvent(false);
        if (onComplete) onComplete();
      } else {
        console.error('Failed to create rule');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Context</label>
            <select value={entity} onChange={e => setEntity(e.target.value as any)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
            <option value="PERSONAL">Personal</option>
            <option value="BUSINESS">Business</option>
            </select>
        </div>
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
               <option value="">None</option>
               {categoryGroups.map(grp => (
                   <optgroup key={grp.id} label={`${grp.name} (${grp.type})`}>
                       {grp.categories.map(cat => (
                           <option key={cat.id} value={cat.id}>{cat.name}</option>
                       ))}
                   </optgroup>
               ))}
            </select>
        </div>
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
               <option value="">Select Account...</option>
               {accounts.map(acc => (
                   <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
               ))}
            </select>
        </div>
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Link to Asset/Loan</label>
            <select value={assetId} onChange={e => setAssetId(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
               <option value="">None (Standalone)</option>
               {assets.map(a => (
                   <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
               ))}
            </select>
        </div>
      </div>
      
      {/* Signage Hint */}
      {categoryId && (
        <div className={`p-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 ${
          categoryGroups.find(g => g.categories.some(c => c.id === categoryId))?.type === 'EXPENSE' 
            ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
            : 'bg-green-500/10 text-green-500 border border-green-500/20'
        }`}>
          {categoryGroups.find(g => g.categories.some(c => c.id === categoryId))?.type === 'EXPENSE' ? 'Money Out (Expense)' : 'Money In (Income)'}
        </div>
      )}

      <div className="flex items-center gap-4 bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-200 dark:border-white/5">
         <div className="flex items-center gap-2">
            <input type="checkbox" id="is_transfer" checked={isTransfer} onChange={e => setIsTransfer(e.target.checked)} />
            <label htmlFor="is_transfer" className="text-sm font-semibold">Is Transfer?</label>
         </div>
         {isTransfer && (
            <div className="flex-1 animate-in fade-in slide-in-from-left-2">
               <select value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)} className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100">
                  <option value="">Target Account...</option>
                  {accounts.filter(a => a.id !== accountId).map(acc => (
                      <option key={acc.id} value={acc.id}>Transfer to: {acc.name}</option>
                  ))}
               </select>
            </div>
         )}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Event Name & Amount</label>
        <div className="grid grid-cols-2 gap-2">
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AWS Bill" className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100" />
            <div className="relative">
                <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 pl-8" />
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${
                    categoryGroups.find(g => g.categories.some(c => c.id === categoryId))?.type === 'EXPENSE' ? 'text-red-500' : 'text-green-500'
                }`}>
                    {categoryGroups.find(g => g.categories.some(c => c.id === categoryId))?.type === 'EXPENSE' ? '-' : '+'}
                </span>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Frequency</label>
            <select value={frequencyType} onChange={e => setFrequencyType(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
            <option value="MONTHLY_DATE">Monthly (Date)</option>
            <option value="FORTNIGHTLY">Fortnightly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="ANNUAL">Annual</option>
            </select>
        </div>
        {frequencyType === 'MONTHLY_DATE' && (
            <div>
                 <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Day of Month</label>
                 <input type="number" min="1" max="31" value={frequencyValue} onChange={e => setFrequencyValue(e.target.value)} placeholder="1-31" className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100" />
            </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Anchor Date</label>
        <div className="relative">
          <LucideCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
          <input
            required
            type="date"
            value={anchorDate}
            onChange={e => setAnchorDate(e.target.value)}
            className="w-full bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg px-4 py-2 pl-10 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] [color-scheme:light]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input type="checkbox" id="tax_deductible" checked={isTaxEvent} onChange={e => setIsTaxEvent(e.target.checked)} className="rounded bg-black/5 border-white/10" />
        <label htmlFor="tax_deductible" className="text-sm">GST/Tax Linked Component</label>
      </div>

      <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg py-3 hover:opacity-90 transition-opacity mt-4">
        Generate Projection Logic
      </button>
    </form>
  );
}
