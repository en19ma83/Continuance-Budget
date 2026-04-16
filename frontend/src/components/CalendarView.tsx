import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { LucideChevronLeft, LucideChevronRight } from 'lucide-react';

type LedgerEntry = {
    id: string;
    date: string;
    amount: number;
    status: 'PROJECTED' | 'ACTUAL' | 'PENDING';
    running_balance: number;
    entity: 'PERSONAL' | 'BUSINESS';
    category_color?: string;
    category_name?: string;
};

export function CalendarView({ entries, baseCurrency = 'AUD' }: { entries: LedgerEntry[], baseCurrency?: string }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const firstDay = startOfMonth(currentMonth);
    const lastDay = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDay, end: lastDay });
    const startingDayIndex = getDay(firstDay);
    const emptySlots = Array.from({ length: startingDayIndex }).fill(null);

    const prevMonth = () => setCurrentMonth(m => subMonths(m, 1));
    const nextMonth = () => setCurrentMonth(m => addMonths(m, 1));
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
                    <div key={day} className="p-3 text-center text-xs font-semibold uppercase tracking-wider bg-black/20 dark:bg-black/40 text-slate-500">
                        {day}
                    </div>
                ))}

                {emptySlots.map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white/5 dark:bg-black/20 min-h-[100px]" />
                ))}

                {daysInMonth.map(day => {
                    const dayEntries = entries.filter(e => isSameDay(new Date(e.date + 'T00:00:00'), day));
                    const endOfDayBalance = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].running_balance : null;
                    const today = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={`min-h-[120px] p-2 flex flex-col transition-colors relative
                                ${today
                                    ? 'bg-blue-500/10 dark:bg-blue-500/10 ring-1 ring-inset ring-blue-500/30'
                                    : 'bg-white/[0.02] dark:bg-black/20 hover:bg-white/5 dark:hover:bg-black/30'
                                }`}
                        >
                            <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                                ${today ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>
                                {format(day, 'd')}
                            </span>

                            <div className="flex-1 overflow-y-auto space-y-1">
                                {dayEntries.map(e => (
                                    <div
                                        key={e.id}
                                        className={`text-[10px] px-1.5 py-0.5 rounded flex justify-between gap-1 ${e.status === 'PROJECTED' ? 'border border-dashed border-white/20' : ''}`}
                                        style={{
                                            backgroundColor: e.category_color ? `${e.category_color}20` : (e.amount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'),
                                            color: e.category_color || (e.amount > 0 ? '#86efac' : '#fca5a5'),
                                        }}
                                    >
                                        <span className="truncate max-w-[50px]">{e.category_name || e.entity}</span>
                                        <span className="shrink-0">{Math.abs(e.amount).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>

                            {endOfDayBalance !== null && (
                                <div className="mt-1 pt-1 border-t border-white/10 text-right text-[10px] font-mono font-semibold text-slate-400">
                                    {endOfDayBalance.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0 })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
