import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns';
import { LucideChevronLeft, LucideChevronRight } from 'lucide-react';

type LedgerEntry = {
    id: string;
    date: string;
    name: string;
    amount: number;
    status: 'PROJECTED' | 'ACTUAL' | 'PENDING';
    running_balance: number;
    liquid_balance: number;
    cc_balance: number;
    entity: 'PERSONAL' | 'BUSINESS';
    category_color?: string;
    category_name?: string;
};

export function CalendarView({ entries, baseCurrency = 'AUD' }: { entries: LedgerEntry[], baseCurrency?: string }) {
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDay, end: lastDay });
    const startingDayIndex = getDay(firstDay);
    const emptySlots = Array.from({ length: startingDayIndex }).fill(null) as null[];

    const prevMonth = () => setCurrentMonth((m: Date) => subMonths(m, 1));
    const nextMonth = () => setCurrentMonth((m: Date) => addMonths(m, 1));
    const goToday = () => setCurrentMonth(new Date());

    const isCurrentMonth =
        currentMonth.getMonth() === new Date().getMonth() &&
        currentMonth.getFullYear() === new Date().getFullYear();

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
                    {!isCurrentMonth && (
                        <button
                            onClick={goToday}
                            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                            Today
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                        title="Previous month"
                    >
                        <LucideChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
                        title="Next month"
                    >
                        <LucideChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/10 dark:bg-white/5 rounded-xl overflow-hidden border border-white/10">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3 text-center text-xs font-semibold uppercase tracking-wider bg-gray-100 dark:bg-black/40 text-slate-500">
                        {day}
                    </div>
                ))}

                {emptySlots.map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white/5 dark:bg-black/20 min-h-[100px]" />
                ))}

                {daysInMonth.map((day: Date) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayEntries = entries.filter(e => e.date.startsWith(dayStr));
                    
                    // Find the last known balance as of this day
                    const entryOnOrBefore = entries
                        .filter(e => e.date <= dayStr)
                        .reduce((prev, curr) => (curr.date >= (prev?.date || '') ? curr : prev), null as LedgerEntry | null);
                    
                    const today = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[120px] p-2 flex flex-col transition-colors relative
                                ${today
                                    ? 'bg-blue-500/10 dark:bg-blue-500/10 ring-1 ring-inset ring-blue-500/30'
                                    : 'bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/30'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                                    ${today ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>
                                    {format(day, 'd')}
                                </span>
                                
                                {entryOnOrBefore && (
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className={`text-[9px] font-mono leading-none ${entryOnOrBefore.liquid_balance < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                            <span className="opacity-40">💵</span> {entryOnOrBefore.liquid_balance.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                        <div className={`text-[9px] font-mono leading-none ${entryOnOrBefore.cc_balance < 0 ? 'text-red-400/80' : 'text-slate-500/70'}`}>
                                            <span className="opacity-40 text-[7px] uppercase tracking-tighter mr-0.5">cc</span> {entryOnOrBefore.cc_balance.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1">
                                {dayEntries.map(e => (
                                    <div
                                        key={e.id}
                                        className={`text-[9px] px-1.5 py-0.5 rounded flex justify-between gap-1 ${e.status === 'PROJECTED' ? 'border border-dashed border-white/20' : ''}`}
                                        style={{
                                            backgroundColor: e.category_color ? `${e.category_color}20` : (e.amount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'),
                                            color: e.category_color || (e.amount > 0 ? '#86efac' : '#fca5a5'),
                                        }}
                                    >
                                        <span className="truncate max-w-[60px] font-medium">{e.name}</span>
                                        <span className="shrink-0 font-bold">{Math.abs(e.amount).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
