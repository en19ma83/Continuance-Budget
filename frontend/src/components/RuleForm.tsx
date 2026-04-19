import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useEntity } from '../contexts/EntityContext';
import { LucideCalendar, LucideCreditCard } from 'lucide-react';

type CategoryType = { id: string, name: string, color: string };
type CategoryGroupType = { id: string, name: string, type: string, categories: CategoryType[] };

export function RuleForm({ onComplete, token }: { onComplete?: () => void, token: string | null }) {
  const { activeEntities } = useEntity();
  const defaultEntity = activeEntities.size > 0 ? Array.from(activeEntities)[0] : 'PERSONAL';

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequencyType, setFrequencyType] = useState('MONTHLY_DATE');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [isTaxEvent, setIsTaxEvent] = useState(false);
  const [gstTreatment, setGstTreatment] = useState('N_A');
  const [entity, setEntity] = useState(defaultEntity);
  const [categoryId, setCategoryId] = useState<string>('');

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroupType[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  // CC payment: funding account (the cash account the payment comes FROM)
  const [fundingAccountId, setFundingAccountId] = useState<string>('');

  const [assets, setAssets] = useState<any[]>([]);
  const [assetId, setAssetId] = useState<string>('');

  // Derived: is the selected primary account a Credit Card?
  const selectedAccount = accounts.find(a => a.id === accountId);
  const isCCAccount = selectedAccount?.type === 'Credit Card';

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

    // CC payment: amount is always positive (credits the CC account, reducing owing).
    // The mirror entry on the funding account will be negative (money out of cash account).
    let finalAmount: number;
    let transferTarget: string | null;
    if (isCCAccount) {
      finalAmount = Math.abs(parseFloat(amount));
      transferTarget = fundingAccountId || null;
    } else {
      finalAmount = isExpense ? -Math.abs(parseFloat(amount)) : parseFloat(amount);
      transferTarget = isTransfer ? targetAccountId : null;
    }

    const payload = {
      name,
      amount: finalAmount,
      frequency_type: frequencyType,
      frequency_value: null, // MONTHLY_DATE derives day from anchor_date; unused for other types
      anchor_date: anchorDate,
      is_tax_deductible: isTaxEvent,
      gst_treatment: entity === 'BUSINESS' ? gstTreatment : 'N_A',
      entity: entity,
      category_id: categoryId || null,
      account_id: accountId || null,
      transfer_to_account_id: transferTarget,
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
        setFundingAccountId('');
        setFrequencyType('MONTHLY_DATE');
        setIsTaxEvent(false);
        setGstTreatment('N_A');
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

      {/* CC Payment mode — shown automatically when a Credit Card account is selected */}
      {isCCAccount ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-widest">
            <LucideCreditCard className="w-3.5 h-3.5" />
            Credit Card Payment
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            This entry will <strong>credit your CC account</strong> (reducing what you owe) and
            <strong> debit the account below</strong> (where the payment comes from).
          </p>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Fund payment from account <span className="text-red-400">*</span>
            </label>
            <select
              value={fundingAccountId}
              onChange={e => setFundingAccountId(e.target.value)}
              className="w-full bg-white dark:bg-black/20 border border-red-500/30 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-400 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select source account...</option>
              {accounts
                .filter(a => a.id !== accountId && a.type !== 'Credit Card')
                .map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                ))}
            </select>
          </div>
        </div>
      ) : (
        /* Regular transfer toggle for non-CC accounts */
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
      )}

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
      
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Frequency</label>
        <select value={frequencyType} onChange={e => setFrequencyType(e.target.value)} className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100">
          <option value="MONTHLY_DATE">Monthly (repeats on anchor day)</option>
          <option value="FORTNIGHTLY">Fortnightly</option>
          <option value="WEEKLY">Weekly</option>
          <option value="ANNUAL">Annual</option>
          <option value="ONCE">One-off (Single Payment)</option>
        </select>
      </div>

      {frequencyType === 'ONCE' && !isCCAccount && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 leading-relaxed animate-in fade-in zoom-in-95">
          <strong>One-off payment:</strong> A single projected entry will be created on the date below.
        </div>
      )}

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
          {frequencyType === 'ONCE' ? 'Payment Date' : frequencyType === 'MONTHLY_DATE' ? 'Anchor Date (repeats this day monthly)' : 'Anchor Date'}
        </label>
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
        <label htmlFor="tax_deductible" className="text-sm">Tax Deductible</label>
      </div>

      {entity === 'BUSINESS' && (
        <div className="animate-in fade-in slide-in-from-top-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">GST / BAS Treatment</label>
          <select
            value={gstTreatment}
            onChange={e => setGstTreatment(e.target.value)}
            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-gray-100"
          >
            <option value="N_A">N/A (No GST)</option>
            <option value="BAS_INCL">Tax Inclusive (GST in amount)</option>
            <option value="BAS_EXCL">Tax Exclusive (GST on top)</option>
            <option value="GST_FREE">GST Free</option>
          </select>
        </div>
      )}

      <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg py-3 hover:opacity-90 transition-opacity mt-4">
        Generate Projection Logic
      </button>
    </form>
  );
}
