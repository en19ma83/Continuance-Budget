import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

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
    // Basic calendar logic for current month
    const today = new Date();
    const firstDay = startOfMonth(today);
    const lastDay = endOfMonth(today);
    const daysInMonth = eachDayOfInterval({ start: firstDay, end: lastDay });
    const startingDayIndex = getDay(firstDay); // Sunday = 0

    // Add empty slots for days before the 1st
    const emptySlots = Array.from({ length: startingDayIndex }).fill(null);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{format(today, 'MMMM yyyy')}</h3>
            </div>
            
            <div className="grid grid-cols-7 gap-px bg-white/20 rounded-xl overflow-hidden glass border border-white/10">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3 text-center text-xs font-semibold uppercase tracking-wider bg-black/40 text-slate-300">
                        {day}
                    </div>
                ))}
                
                {emptySlots.map((_, i) => (
                    <div key={`empty-${i}`} className="bg-black/20 min-h-[100px]"></div>
                ))}
                
                {daysInMonth.map(day => {
                    // Filter entries for this day
                    const dayEntries = entries.filter(e => isSameDay(new Date(e.date), day));
                    // Get closing balance (last entry of the day, or undefined if none)
                    const endOfDayBalance = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].running_balance : null;
                    
                    return (
                        <div key={day.toISOString()} className="bg-black/30 min-h-[120px] p-2 flex flex-col group hover:bg-black/50 transition-colors relative">
                            <span className="text-xs font-bold text-slate-400 mb-1">{format(day, 'd')}</span>
                            
                            <div className="flex-1 overflow-y-auto space-y-1">
                                {dayEntries.map(e => (
                                    <div 
                                        key={e.id} 
                                        className={`text-[10px] px-1.5 py-0.5 rounded flex justify-between ${e.status === 'PROJECTED' ? 'border border-dashed border-white/20' : ''}`}
                                        style={{ 
                                            backgroundColor: e.category_color ? `${e.category_color}20` : (e.amount > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                                            color: e.category_color || (e.amount > 0 ? '#86efac' : '#fca5a5')
                                        }}
                                    >
                                        <span className="truncate max-w-[50px]">{e.category_name || e.entity}</span>
                                        <span>{Math.abs(e.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-2 pt-2 border-t border-white/10">
                                {endOfDayBalance !== null && (
                                    <div className="text-right text-xs font-mono font-semibold opacity-90">
                                        {endOfDayBalance.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0 })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
