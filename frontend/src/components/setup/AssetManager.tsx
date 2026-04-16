import { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/api';
import { useEntity } from '../../contexts/EntityContext';
import { LucidePlus, LucideX, LucideBaggageClaim, LucideTrendingDown, LucideHistory, LucideLink, LucideRefreshCw, Edit3, Trash2 } from 'lucide-react';

type Asset = {
  id: string;
  name: string;
  type: string;
  entity: string;
  starting_value: number;
  current_value: number;
  is_liability: boolean;
  interest_rate?: number;
  ticker?: string;
  linked_loan_id?: string;
  equity?: number;
  lvr?: number;
};

export function AssetManager({ onRefresh, baseCurrency = 'AUD', token }: { onRefresh: () => void, baseCurrency?: string, token: string | null }) {
  const { activeEntities } = useEntity();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [newType, setNewType] = useState('PROPERTY');
  const [newValue, setNewValue] = useState('0');
  const [newEntity, setNewEntity] = useState(Array.from(activeEntities)[0] || 'PERSONAL');
  const [isLiability, setIsLiability] = useState(false);
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [ticker, setTicker] = useState('');
  const [linkedLoanId, setLinkedLoanId] = useState('');
  const [trackLoan, setTrackLoan] = useState(false);
  const [loanBalance, setLoanBalance] = useState('0');
  const [loanRate, setLoanRate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchAssets = async () => {
    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    const res = await fetch(`${API_BASE}/api/assets?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setAssets(data);
  };

  useEffect(() => { 
    if (token) fetchAssets(); 
  }, [activeEntities, token]);

  const handleCreate = async () => {
    let finalLinkedLoanId = linkedLoanId;

    // If "Track a loan" is enabled, create the liability first
    if (trackLoan && !isLiability && newType !== 'LOAN') {
      const loanPayload = {
        name: `Loan for ${newName}`,
        type: 'LOAN',
        entity: newEntity,
        starting_value: parseFloat(loanBalance),
        current_value: parseFloat(loanBalance),
        is_liability: true,
        interest_rate: loanRate ? parseFloat(loanRate) : null,
      };
      
      const loanRes = await fetch(`${API_BASE}/api/assets`, {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }, 
        body: JSON.stringify(loanPayload)
      });
      
      if (loanRes.ok) {
        const loanData = await loanRes.json();
        finalLinkedLoanId = loanData.id;
      }
    }

    const payload: any = {
      name: newName,
      type: newType,
      entity: newEntity,
      starting_value: parseFloat(newValue),
      current_value: parseFloat(newValue),
      is_liability: isLiability,
      interest_rate: interestRate ? parseFloat(interestRate) : null,
      term_months: termMonths ? parseInt(termMonths) : null,
      ticker: ticker || null,
      linked_loan_id: finalLinkedLoanId || null,
    };
    
    const url = editingId ? `${API_BASE}/api/assets/${editingId}` : `${API_BASE}/api/assets`;
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
      setNewValue('0');
      setInterestRate(''); 
      setTermMonths(''); 
      setTicker(''); 
      setLinkedLoanId('');
      setTrackLoan(false);
      setLoanBalance('0');
      setLoanRate('');
      fetchAssets(); 
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this asset and its history?')) {
      const res = await fetch(`${API_BASE}/api/assets/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAssets();
        onRefresh();
      }
    }
  };

  const startEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setNewName(asset.name);
    setNewType(asset.type);
    setNewValue(asset.current_value.toString());
    setNewEntity(asset.entity as any);
    setIsLiability(asset.is_liability);
    setInterestRate(asset.interest_rate?.toString() || '');
    setTicker(asset.ticker || '');
    setLinkedLoanId(asset.linked_loan_id || '');
    setShowAdd(true);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/assets/sync-prices`, { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAssets();
        onRefresh();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const updateValue = async (id: string, val: number) => {
    const newVal = prompt("Enter new current value:", val.toString());
    if (newVal) {
      await fetch(`${API_BASE}/api/assets/${id}/value`, {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: new Date().toISOString().split('T')[0], value: parseFloat(newVal) })
      });
      fetchAssets(); onRefresh();
    }
  };

  const loanAssets = assets.filter(a => a.type === 'LOAN' || a.is_liability);
  const fmt = (v: number) => v.toLocaleString('en-AU', { style: 'currency', currency: baseCurrency, maximumFractionDigits: 0 });

  // Build linked pairs for visual grouping
  const pairedIds = new Set<string>();
  const linkedPairs: { asset: Asset; loan: Asset }[] = [];
  assets.forEach(a => {
    if (a.linked_loan_id) {
      const loan = assets.find(l => l.id === a.linked_loan_id);
      if (loan) {
        linkedPairs.push({ asset: a, loan });
        pairedIds.add(a.id);
        pairedIds.add(loan.id);
      }
    }
  });
  const standaloneAssets = assets.filter(a => !pairedIds.has(a.id));

  return (
    <div className="space-y-6 pt-6 border-t border-white/10 dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">Assets &amp; Liabilities</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Non-liquid wealth and long-term debt</p>
        </div>
        <div className="flex items-center gap-2">
          {assets.some(a => a.ticker) && (
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-full transition-all flex items-center gap-2 px-3 ${isSyncing ? 'opacity-50 cursor-wait' : ''}`}
            >
              <LucideRefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Sync Prices</span>
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)} className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-full transition-colors">
            {showAdd ? <LucideX className="w-4 h-4" /> : <LucidePlus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="glass p-4 rounded-xl border border-purple-500/30 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">{editingId ? 'Editing Asset' : 'Add New Asset'}</div>
          <input placeholder="Asset Name (e.g. Primary Residence)" value={newName} onChange={e => setNewName(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={newType} onChange={e => setNewType(e.target.value)} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="PROPERTY">Property</option>
              <option value="STOCK">Stock Portfolio</option>
              <option value="VEHICLE">Vehicle</option>
              <option value="LOAN">Loan/Debt</option>
              <option value="OTHER">Other</option>
            </select>
            <select value={newEntity} onChange={e => setNewEntity(e.target.value as any)} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Current Market Value</label>
              <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
            {newType === 'LOAN' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Interest Rate (%)</label>
                <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 5.5" />
              </div>
            )}
            {newType === 'STOCK' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Ticker Symbol</label>
                <input value={ticker} onChange={e => setTicker(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="e.g. TSLA" />
              </div>
            )}
          </div>

          {/* Integrated Loan Creation Toggle */}
          {!isLiability && newType !== 'LOAN' && (
            <div className="space-y-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={trackLoan} onChange={e => setTrackLoan(e.target.checked)} id="track-loan" />
                <label htmlFor="track-loan" className="text-xs font-semibold text-blue-400">Track a loan/mortgage for this asset?</label>
              </div>
              
              {trackLoan && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Loan Principal Balance</label>
                    <input type="number" value={loanBalance} onChange={e => setLoanBalance(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Interest Rate (%)</label>
                    <input type="number" step="0.01" value={loanRate} onChange={e => setLoanRate(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs" placeholder="e.g. 6.2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Existing Link to loan — hidden if creating an integrated loan */}
          {!isLiability && newType !== 'LOAN' && !trackLoan && loanAssets.length > 0 && (
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1">
                <LucideLink className="w-3 h-3" /> Link to Existing Mortgage/Loan
              </label>
              <select value={linkedLoanId} onChange={e => setLinkedLoanId(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="">No linked loan</option>
                {loanAssets.map(l => <option key={l.id} value={l.id}>{l.name} (${l.current_value.toLocaleString()})</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={isLiability} onChange={e => setIsLiability(e.target.checked)} id="is-liability" />
            <label htmlFor="is-liability" className="text-xs">This is a Liability (standalone debt)?</label>
          </div>

          <button onClick={handleCreate} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-lg text-sm transition-colors">
            {editingId ? 'Update Asset' : 'Add to Net Worth'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {/* Linked asset+loan pairs */}
        {linkedPairs.map(({ asset, loan }) => (
          <div key={asset.id} className="relative rounded-2xl border border-green-500/30 bg-green-500/5 p-1 space-y-1">
            {/* Connector label */}
            <div className="absolute -top-2.5 left-4 flex items-center gap-1 bg-green-900/80 dark:bg-green-900/80 px-2 py-0.5 rounded-full border border-green-500/40 z-10">
              <LucideLink className="w-2.5 h-2.5 text-green-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-green-400">Linked</span>
            </div>
            {/* Left bracket line */}
            <div className="absolute left-2.5 top-6 bottom-6 w-0.5 rounded-full bg-green-500/30" />
            <div className="pl-2">
              {[asset, loan].map(a => {
                const hasEquity = a.equity !== undefined && a.equity !== null;
                return (
                  <AssetCard key={a.id} asset={a} hasEquity={hasEquity} fmt={fmt} onEdit={startEdit} onDelete={handleDelete} onUpdateValue={updateValue} />
                );
              })}
            </div>
          </div>
        ))}

        {/* Standalone assets */}
        {standaloneAssets.map(asset => {
          const hasEquity = asset.equity !== undefined && asset.equity !== null;
          return <AssetCard key={asset.id} asset={asset} hasEquity={hasEquity} fmt={fmt} onEdit={startEdit} onDelete={handleDelete} onUpdateValue={updateValue} />;
        })}

        {assets.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-[11px] italic">No assets or liabilities tracked.</div>
        )}
      </div>
    </div>
  );
}

function AssetCard({ asset, hasEquity, fmt, onEdit, onDelete, onUpdateValue }: {
  asset: Asset;
  hasEquity: boolean;
  fmt: (v: number) => string;
  onEdit: (a: Asset) => void;
  onDelete: (id: string) => void;
  onUpdateValue: (id: string, val: number) => void;
}) {
  return (
    <div className={`p-4 rounded-xl border glass flex flex-col gap-2 ${hasEquity ? 'border-green-500/20' : asset.is_liability ? 'border-red-500/20' : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${asset.is_liability ? 'bg-red-500/20 text-red-400' : hasEquity ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'}`}>
            {asset.is_liability ? <LucideTrendingDown className="w-5 h-5" /> : <LucideBaggageClaim className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              {asset.name}
              {asset.ticker && <span className="text-[9px] bg-white/10 px-1 rounded uppercase">{asset.ticker}</span>}
              {hasEquity && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Equity Tracked</span>}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              {asset.type} • {asset.entity}
              {asset.interest_rate && ` • ${asset.interest_rate}% APR`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={`font-bold text-sm ${asset.is_liability ? 'text-red-400' : 'text-purple-400'}`}>
              {asset.is_liability ? '-' : ''}{fmt(asset.current_value)}
            </div>
            <button
              onClick={() => onUpdateValue(asset.id, asset.current_value)}
              className="text-[9px] text-slate-500 hover:text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <LucideHistory className="w-2 h-2" /> Update Value
            </button>
          </div>
          <div className="flex flex-col gap-1 ml-2">
            <button onClick={() => onEdit(asset)} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(asset.id)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {hasEquity && (
        <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-white/5">
          <div className="text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Market Value</div>
            <div className="text-xs font-bold">{fmt(asset.current_value)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Equity</div>
            <div className={`text-xs font-bold ${asset.equity! >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(asset.equity!)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">LVR</div>
            <div className={`text-xs font-bold ${(asset.lvr || 0) > 80 ? 'text-red-400' : (asset.lvr || 0) > 60 ? 'text-amber-400' : 'text-green-400'}`}>
              {asset.lvr?.toFixed(1)}%
              <span className="text-[8px] text-slate-500 ml-1 font-normal">{(asset.lvr || 0) > 80 ? 'High Risk' : (asset.lvr || 0) > 60 ? 'Moderate' : 'Safe'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
