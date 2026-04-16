import { ArrowRight, Trash2 } from 'lucide-react';
import { format, isBefore, isAfter, startOfDay } from 'date-fns';
import { API_BASE } from '../utils/api';

type LedgerEntry = {
    id: string;
    date: string;
    name?: string;
    amount: number;
    status: 'PROJECTED' | 'ACTUAL' | 'PENDING';
    running_balance: number;
    entity: 'PERSONAL' | 'BUSINESS';
    category_name?: string;
    category_color?: string;
    rule_id?: string;
};

export function TimelineView({ entries, baseCurrency = 'AUD' }: { entries: LedgerEntry[], baseCurrency?: string }) {
    const today = startOfDay(new Date());

    return (
        <div className="space-y-4">
            {entries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No events found.</div>
            ) : (
                entries.map((entry, index) => {
                    const entryDate = startOfDay(new Date(entry.date));
                    const isToday = format(entryDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                    const isFuture = isAfter(entryDate, today);

                    // Show "Present Day" divider if this is the first future/today item
                    const showDivider = index === 0 ? isFuture || isToday : 
                        (isBefore(startOfDay(new Date(entries[index - 1].date)), today) && (isFuture || isToday));

                    return (
                        <div key={entry.id}>
                            {showDivider && (
                                <div className="flex items-center gap-4 my-6">
                                    <div className="h-px bg-blue-500/50 flex-1"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-blue-500 flex items-center gap-2">
                                        Present Day <ArrowRight className="w-4 h-4" />
                                    </span>
                                    <div className="h-px bg-blue-500/50 flex-1"></div>
                                </div>
                            )}
                            
                            <div className={`group p-4 rounded-xl flex items-center justify-between border transition-all relative overflow-hidden ${
                                entry.status === 'PROJECTED' 
                                    ? 'bg-black/5 border-transparent opacity-80 border-dashed hover:border-white/20' 
                                    : 'glass border-white/10 shadow-sm'
                            }`}>
                                {/* Category Color Bar */}
                                {entry.category_color && (
                                    <div 
                                        className="absolute left-0 top-0 bottom-0 w-1 opacity-60" 
                                        style={{ backgroundColor: entry.category_color }}
                                    />
                                )}

                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-black/10 flex flex-col items-center justify-center text-xs font-semibold">
                                        <span className="opacity-60">{format(entryDate, 'MMM')}</span>
                                        <span>{format(entryDate, 'd')}</span>
                                    </div>
                                    <div>
                                        <div className="font-semibold">{entry.name || entry.category_name || (entry.entity + ' Event')}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{entry.category_name || 'Uncategorized'}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 capitalize flex items-center gap-2">
                                            {entry.status.toLowerCase()}
                                            {entry.status === 'PROJECTED' && (
                                                <button 
                                                    className="px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors opacity-0 group-hover:opacity-100"
                                                    onClick={() => {
                                                        const amt = prompt('Confirm actual amount:', entry.amount.toString());
                                                        if (amt) {
                                                            fetch(`${API_BASE}/api/transactions/${entry.id}/match`, {
                                                                method: 'POST',
                                                                headers: {'Content-Type': 'application/json'},
                                                                body: JSON.stringify({ actual_amount: parseFloat(amt), actual_date: entry.date })
                                                            }).then(() => window.location.reload());
                                                        }
                                                    }}
                                                >
                                                    Confirm Reconcile
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <div className={`font-medium ${entry.amount > 0 ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
                                            {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono mt-1">
                                            Bal: {entry.running_balance?.toLocaleString('en-US', { style: 'currency', currency: baseCurrency })}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this entry? (Note: Deleting a projected entry may delete its recurring rule)')) {
                                                const endpoint = entry.rule_id && entry.status === 'PROJECTED' 
                                                    ? `${API_BASE}/api/rules/${entry.rule_id}`
                                                    : `${API_BASE}/api/transactions/${entry.id}`;
                                                
                                                fetch(endpoint, { method: 'DELETE' })
                                                    .then(() => window.location.reload());
                                            }
                                        }}
                                        className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
