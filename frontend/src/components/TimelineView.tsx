import { useState } from 'react';
import { ArrowRight, Trash2, Edit3, Check, X } from 'lucide-react';
import { format, isBefore, isAfter, startOfDay } from 'date-fns';
import { API_BASE } from '../utils/api';
import { Dialog } from './Dialog';

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

type DialogState =
    | { type: 'reconcile'; entry: LedgerEntry; value: string }
    | { type: 'delete';    entry: LedgerEntry }
    | null;

type EditState = {
    id: string;
    name: string;
    amount: string;
    date: string;
} | null;

export function TimelineView({
    entries,
    baseCurrency = 'AUD',
    token,
    onRefresh,
}: {
    entries: LedgerEntry[];
    baseCurrency?: string;
    token?: string | null;
    onRefresh?: () => void;
}) {
    const today = startOfDay(new Date());
    const [dialog, setDialog] = useState<DialogState>(null);
    const [editState, setEditState] = useState<EditState>(null);
    const [saving, setSaving] = useState(false);

    const authHeaders = (extra: Record<string, string> = {}) => ({
        ...extra,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    const handleReconcileConfirm = (value: string) => {
        if (!dialog || dialog.type !== 'reconcile') return;
        const entry = dialog.entry;
        setDialog(null);
        fetch(`${API_BASE}/api/transactions/${entry.id}/match`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ actual_amount: parseFloat(value), actual_date: entry.date }),
        }).then(() => onRefresh?.());
    };

    const handleDeleteConfirm = () => {
        if (!dialog || dialog.type !== 'delete') return;
        const entry = dialog.entry;
        setDialog(null);
        const endpoint = entry.rule_id && entry.status === 'PROJECTED'
            ? `${API_BASE}/api/rules/${entry.rule_id}`
            : `${API_BASE}/api/transactions/${entry.id}`;
        fetch(endpoint, { method: 'DELETE', headers: authHeaders() }).then(() => onRefresh?.());
    };

    const startEdit = (entry: LedgerEntry) => {
        setEditState({
            id: entry.id,
            name: entry.name || '',
            amount: Math.abs(entry.amount).toString(),
            date: entry.date,
        });
    };

    const handleSaveEdit = async () => {
        if (!editState) return;
        const entry = entries.find(e => e.id === editState.id);
        if (!entry) return;

        // Preserve sign of original amount
        const sign = entry.amount < 0 ? -1 : 1;
        const newAmount = sign * Math.abs(parseFloat(editState.amount));

        setSaving(true);
        try {
            await fetch(`${API_BASE}/api/transactions/${editState.id}`, {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    name: editState.name || undefined,
                    amount: isNaN(newAmount) ? undefined : newAmount,
                    date: editState.date || undefined,
                }),
            });
            setEditState(null);
            onRefresh?.();
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {dialog?.type === 'reconcile' && (
                <Dialog
                    type="prompt"
                    title="Confirm Reconcile"
                    message={`Reconciling "${dialog.entry.name || dialog.entry.category_name || 'entry'}" — enter the actual amount received or paid.`}
                    inputLabel="Actual Amount"
                    inputType="number"
                    value={dialog.value}
                    onChange={v => setDialog(d => d?.type === 'reconcile' ? { ...d, value: v } : d)}
                    confirmLabel="Reconcile"
                    onConfirm={handleReconcileConfirm}
                    onCancel={() => setDialog(null)}
                />
            )}

            {dialog?.type === 'delete' && (
                <Dialog
                    type="confirm"
                    title="Delete Entry"
                    message={
                        dialog.entry.rule_id && dialog.entry.status === 'PROJECTED'
                            ? 'This will delete the recurring rule and all its projected entries. This cannot be undone.'
                            : 'Delete this ledger entry? This cannot be undone.'
                    }
                    variant="danger"
                    confirmLabel="Delete"
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDialog(null)}
                />
            )}

            <div className="space-y-4">
                {entries.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">No events found.</div>
                ) : (
                    entries.map((entry, index) => {
                        const entryDate = startOfDay(new Date(entry.date));
                        const isToday = format(entryDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                        const isFuture = isAfter(entryDate, today);
                        const isEditing = editState?.id === entry.id;

                        const showDivider = index === 0
                            ? isFuture || isToday
                            : isBefore(startOfDay(new Date(entries[index - 1].date)), today) && (isFuture || isToday);

                        return (
                            <div key={entry.id}>
                                {showDivider && (
                                    <div className="flex items-center gap-4 my-6">
                                        <div className="h-px bg-blue-500/50 flex-1" />
                                        <span className="text-xs font-bold uppercase tracking-widest text-blue-500 flex items-center gap-2">
                                            Present Day <ArrowRight className="w-4 h-4" />
                                        </span>
                                        <div className="h-px bg-blue-500/50 flex-1" />
                                    </div>
                                )}

                                <div className={`group p-4 rounded-xl flex items-center justify-between border transition-all relative overflow-hidden ${
                                    isEditing
                                        ? 'glass border-blue-500/40 shadow-md'
                                        : entry.status === 'PROJECTED'
                                            ? 'bg-black/5 border-transparent opacity-80 border-dashed hover:border-white/20'
                                            : 'glass border-white/10 shadow-sm'
                                }`}>
                                    {entry.category_color && !isEditing && (
                                        <div
                                            className="absolute left-0 top-0 bottom-0 w-1 opacity-60"
                                            style={{ backgroundColor: entry.category_color }}
                                        />
                                    )}

                                    {isEditing ? (
                                        /* ── Inline edit mode ── */
                                        <div className="flex-1 flex items-center gap-3 animate-in fade-in">
                                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <Edit3 className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <input
                                                    type="text"
                                                    value={editState!.name}
                                                    onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                                                    placeholder="Name"
                                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm col-span-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editState!.amount}
                                                    onChange={e => setEditState(s => s ? { ...s, amount: e.target.value } : s)}
                                                    placeholder="Amount"
                                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                                <input
                                                    type="date"
                                                    value={editState!.date}
                                                    onChange={e => setEditState(s => s ? { ...s, date: e.target.value } : s)}
                                                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none dark:[color-scheme:dark]"
                                                />
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => setEditState(null)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Normal read mode ── */
                                        <>
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
                                                                onClick={() => setDialog({ type: 'reconcile', entry, value: entry.amount.toString() })}
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
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); startEdit(entry); }}
                                                        className="p-1 px-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setDialog({ type: 'delete', entry }); }}
                                                        className="p-1 px-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}
