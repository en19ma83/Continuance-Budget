import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { LucideCalendar, LucideChevronUp, LucideChevronDown, LucideMinus } from 'lucide-react';

type LedgerEntry = {
    date: string;
    running_balance: number;
};

type Horizon = { key: string; label: string; months: number | null };

const PRESETS: Horizon[] = [
    { key: '1m',  label: '1 Month',   months: 1  },
    { key: '3m',  label: '3 Months',  months: 3  },
    { key: '6m',  label: '6 Months',  months: 6  },
    { key: '12m', label: '12 Months', months: 12 },
];

function balanceAt(entries: LedgerEntry[], targetDate: Date): number | null {
    const target = format(targetDate, 'yyyy-MM-dd');
    const before = entries.filter(e => e.date <= target);
    return before.length > 0 ? before[before.length - 1].running_balance : null;
}

function Delta({ value, currency }: { value: number; currency: string }) {
    const fmt = (v: number) =>
        Math.abs(v).toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 0 });

    if (value === 0) return (
        <span className="flex items-center gap-0.5 text-slate-400 text-xs font-semibold">
            <LucideMinus className="w-3 h-3" /> No change
        </span>
    );
    const positive = value > 0;
    return (
        <span className={`flex items-center gap-0.5 text-xs font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {positive
                ? <LucideChevronUp className="w-3.5 h-3.5" />
                : <LucideChevronDown className="w-3.5 h-3.5" />}
            {fmt(value)}
        </span>
    );
}

export function CashFlowHorizons({
    entries,
    baseCurrency = 'AUD',
}: {
    entries: LedgerEntry[];
    baseCurrency?: string;
}) {
    const [customDate, setCustomDate] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    const today = new Date();
    const todayBalance = balanceAt(entries, today);

    const fmt = (v: number | null) =>
        v === null
            ? '—'
            : v.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0 });

    const renderCard = (
        key: string,
        label: string,
        targetDate: Date,
        sublabel: string,
    ) => {
        const balance = balanceAt(entries, targetDate);
        const delta = balance !== null && todayBalance !== null ? balance - todayBalance : null;
        const isSelected = selected === key;

        return (
            <button
                key={key}
                onClick={() => setSelected(isSelected ? null : key)}
                className={`flex-1 min-w-[120px] flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all
                    ${isSelected
                        ? 'border-blue-500/60 bg-blue-500/10 dark:bg-blue-500/10 shadow-md shadow-blue-500/10'
                        : 'border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:border-blue-500/30 hover:bg-blue-500/5'
                    }`}
            >
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}>
                        {label}
                    </span>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">{sublabel}</div>
                <div className={`text-lg font-black tracking-tight ${balance === null ? 'text-slate-500' : isSelected ? 'text-blue-300 dark:text-blue-300 text-gray-700' : 'text-gray-900 dark:text-gray-100'}`}>
                    {fmt(balance)}
                </div>
                {delta !== null && <Delta value={delta} currency={baseCurrency} />}
                {balance === null && (
                    <span className="text-[10px] text-slate-500 italic">No forecast data</span>
                )}
            </button>
        );
    };

    return (
        <div className="glass p-5 rounded-3xl border border-gray-200 dark:border-white/10 col-span-1 md:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <LucideCalendar className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Projected Cash Flow Horizons</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                        Forecasted liquidity at key milestones · deltas vs today
                        {todayBalance !== null && (
                            <> · Today: <span className="font-semibold text-slate-400">{fmt(todayBalance)}</span></>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                {PRESETS.map(h =>
                    renderCard(
                        h.key,
                        h.label,
                        addMonths(today, h.months!),
                        format(addMonths(today, h.months!), 'd MMM yyyy'),
                    )
                )}

                {/* Custom horizon */}
                <div className={`flex-1 min-w-[140px] flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all
                    ${selected === 'custom'
                        ? 'border-purple-500/60 bg-purple-500/10 shadow-md shadow-purple-500/10'
                        : 'border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:border-purple-500/30 hover:bg-purple-500/5'
                    }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${selected === 'custom' ? 'text-purple-400' : 'text-slate-500'}`}>
                        Custom
                    </span>
                    <input
                        type="date"
                        value={customDate}
                        min={format(today, 'yyyy-MM-dd')}
                        onChange={e => { setCustomDate(e.target.value); setSelected('custom'); }}
                        className="w-full bg-transparent border-b border-gray-300 dark:border-white/20 text-xs py-0.5 outline-none focus:border-purple-400 dark:[color-scheme:dark] text-gray-900 dark:text-gray-100"
                    />
                    {customDate && (() => {
                        const target = parseISO(customDate);
                        const balance = balanceAt(entries, target);
                        const delta = balance !== null && todayBalance !== null ? balance - todayBalance : null;
                        return (
                            <>
                                <div className={`text-lg font-black tracking-tight ${balance === null ? 'text-slate-500' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {fmt(balance)}
                                </div>
                                {delta !== null && <Delta value={delta} currency={baseCurrency} />}
                                {balance === null && <span className="text-[10px] text-slate-500 italic">No forecast data</span>}
                            </>
                        );
                    })()}
                    {!customDate && <span className="text-[10px] text-slate-500 italic">Pick a date</span>}
                </div>
            </div>
        </div>
    );
}
