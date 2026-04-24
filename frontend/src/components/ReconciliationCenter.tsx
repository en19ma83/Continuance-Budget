import { useState, useEffect } from 'react';
import { format, isWithinInterval, addDays, subDays } from 'date-fns';
import { Import, CheckCircle, AlertCircle, PlusSquare, Trash2 } from 'lucide-react';
import { useEntity } from '../contexts/EntityContext';
import { API_BASE } from '../utils/api';
import { Dialog } from './Dialog';

type StatementTx = {
    id: string;
    date: string;
    amount: number;
    description: string;
    entity: string;
    account_id: string;
};

type GhostEntry = {
    id: string;
    date: string;
    amount: number;
    status: string;
    account_id: string;
    category_name?: string;
    category_color?: string;
};

export function ReconciliationCenter({ ghostEntries, onRefresh, baseCurrency = 'AUD', token, refreshKey }: { ghostEntries: GhostEntry[], onRefresh: () => void, baseCurrency?: string, token: string | null, refreshKey?: number }) {
    const { activeEntities } = useEntity();
    const [unmatched, setUnmatched] = useState<StatementTx[]>([]);
    const [categoryGroups, setCategoryGroups] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isFastCategorizing, setIsFastCategorizing] = useState<string | null>(null);
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedAcc, setSelectedAcc] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchUnmatched = async () => {
        const entity = Array.from(activeEntities)[0] || 'PERSONAL';
        try {
            const res = await fetch(`${API_BASE}/api/recon/unmatched?entity=${entity}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setUnmatched(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchUnmatched();
        fetch(`${API_BASE}/api/categories/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(setCategoryGroups);
        const params = new URLSearchParams();
        activeEntities.forEach(e => params.append('entities', e));
        fetch(`${API_BASE}/api/accounts?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(data => {
            setAccounts(data);
            if (data.length > 0) setSelectedAcc(data[0].id);
        });
    }, [activeEntities, token, refreshKey]);

    const handleFastCreate = async (statementId: string) => {
        if (!selectedCat || !selectedAcc) return;
        try {
            const res = await fetch(`${API_BASE}/api/recon/create-from-statement`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ statement_id: statementId, category_id: selectedCat, account_id: selectedAcc })
            });
            if (res.ok) {
                setIsFastCategorizing(null);
                fetchUnmatched();
                onRefresh();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleMatch = async (statementId: string, ghostId: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/recon/match`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ statement_id: statementId, ledger_id: ghostId })
            });
            if (res.ok) {
                fetchUnmatched();
                onRefresh();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteStatementLine = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`${API_BASE}/api/recon/${deleteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchUnmatched();
            }
            setDeleteId(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Statement Staging Area</h3>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{unmatched.length} unmatched</span>
            </div>

            {unmatched.length === 0 ? (
                <div className="glass p-12 rounded-2xl text-center border border-white/10 text-slate-500">
                    <Import className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No unmatched statement items. Import a bank CSV to start.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {unmatched.map(item => {
                        // Find suggested matches: same account, same entity, amount matches or close (+/- $15), within +/- 7 days
                        const suggestions = ghostEntries.filter(g => 
                            g.account_id === item.account_id &&
                            (g.status === 'PROJECTED' || g.status === 'ACTUAL') && 
                            Math.abs(Math.abs(g.amount) - Math.abs(item.amount)) <= 15 &&
                            isWithinInterval(new Date(g.date), {
                                start: subDays(new Date(item.date), 7),
                                end: addDays(new Date(item.date), 7)
                            })
                        );

                        return (
                            <div key={item.id} className="glass p-4 rounded-xl border border-white/10 animate-in fade-in zoom-in-95 relative group/item">
                                <button 
                                    onClick={() => setDeleteId(item.id)}
                                    className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all z-10"
                                    title="Delete Statement Line"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>

                                <div className="flex justify-between items-start mb-4 pr-6">
                                    <div>
                                        <div className="font-semibold text-sm truncate max-w-[200px]">{item.description}</div>
                                        <div className="text-[10px] text-slate-500">{format(new Date(item.date), 'MMMM d, yyyy')}</div>
                                    </div>
                                    <div className="font-bold text-sm">
                                        {item.amount.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Suggested Targets</div>
                                    {suggestions.length > 0 ? (
                                        suggestions.sort((a, b) => {
                                            const aExact = a.date === item.date && a.amount === item.amount ? 0 : 1;
                                            const bExact = b.date === item.date && b.amount === item.amount ? 0 : 1;
                                            return aExact - bExact;
                                        }).map(g => {
                                            const isExactMatch = g.date === item.date && g.amount === item.amount;
                                            const isReconciled = g.status === 'ACTUAL';
                                            
                                            return (
                                                <button 
                                                    key={g.id}
                                                    onClick={() => handleMatch(item.id, g.id)}
                                                    className={`w-full flex items-center justify-between text-[11px] p-2 rounded transition-colors group border ${isExactMatch ? 'bg-blue-500/10 border-blue-500/30' : 'hover:bg-white/5 border-white/10'}`}
                                                    style={{ borderLeft: g.category_color ? `4px solid ${g.category_color} ` : undefined }}
                                                >
                                                    <div className="flex items-center gap-2 text-left">
                                                        <CheckCircle className={`w-3 h-3 ${isExactMatch ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                                                        <div>
                                                            <div className="font-semibold">{format(new Date(g.date), 'MMM d')} - {g.category_name || 'Uncategorized'} ({g.amount.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })})</div>
                                                            {isExactMatch && !isReconciled && <div className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">Recommended Match</div>}
                                                            {isReconciled && <div className="text-[9px] text-amber-400 font-bold uppercase tracking-tighter">Already Reconciled (Override?)</div>}
                                                            {!isExactMatch && !isReconciled && <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Closest Match (±$15)</div>}
                                                        </div>
                                                    </div>
                                                    <span className="font-bold group-hover:scale-105 transition-transform shrink-0 ml-2">Confirm & Pair</span>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                                No automated match found.
                                            </div>
                                            
                                            {isFastCategorizing === item.id ? (
                                                <div className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/10 animate-in slide-in-from-top-2">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Target Account</label>
                                                        <select value={selectedAcc} onChange={e => setSelectedAcc(e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] outline-none">
                                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Select Category {item.amount > 0 ? '(Refund)' : ''}</label>
                                                        <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] outline-none">
                                                            <option value="">Choose category...</option>
                                                            {categoryGroups.map(grp => (
                                                                <optgroup key={grp.id} label={grp.name}>
                                                                    {grp.categories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                                                </optgroup>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleFastCreate(item.id)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold py-1 rounded transition-colors">Confirm & Create</button>
                                                        <button onClick={() => setIsFastCategorizing(null)} className="px-2 bg-white/10 hover:bg-white/20 text-[11px] rounded transition-colors">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setIsFastCategorizing(item.id)}
                                                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-bold text-slate-300 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <PlusSquare className="w-3 h-3" /> Quick Categorize as New
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {deleteId && (
                <Dialog
                    type="confirm"
                    title="Confirm Deletion"
                    message="Deleting statement lines is not recommended as it may not reflect the true balance of your account."
                    confirmLabel="DELETE"
                    cancelLabel="CANCEL"
                    variant="danger"
                    onConfirm={handleDeleteStatementLine}
                    onCancel={() => setDeleteId(null)}
                />
            )}
        </div>
    );
}
