import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, startOfMonth, addMonths, isSameMonth, parseISO } from 'date-fns';
import { LucideChevronLeft, LucideChevronRight, LucideTrendingUp, LucideTrendingDown, LucidePieChart } from 'lucide-react';

type LedgerEntry = {
    date: string;
    amount: number;
    category_name?: string;
    category_color?: string;
};

export function AnalysisCharts({
    entries,
    baseCurrency = 'AUD',
}: {
    entries: LedgerEntry[];
    baseCurrency?: string;
}) {
    const [monthOffset, setMonthOffset] = useState(0);
    const targetMonth = useMemo(() => startOfMonth(addMonths(new Date(), monthOffset)), [monthOffset]);

    const monthData = useMemo(() => {
        const start = targetMonth;

        const filtered = entries.filter(e => {
            const d = parseISO(e.date);
            return isSameMonth(d, start);
        });

        let income = 0;
        let expenses = 0;
        const categoryMap: Record<string, { name: string; value: number; color: string }> = {};

        filtered.forEach(e => {
            if (e.amount > 0) {
                income += e.amount;
            } else {
                const absAmt = Math.abs(e.amount);
                expenses += absAmt;
                const catName: string = e.category_name || 'Uncategorized';
                if (!categoryMap[catName]) {
                    categoryMap[catName] = { name: catName, value: 0, color: e.category_color || '#64748b' };
                }
                categoryMap[catName].value += absAmt;
            }
        });

        const pieData = Object.values(categoryMap).sort((a, b) => b.value - a.value);
        const ratio = expenses > 0 ? (income / expenses) * 100 : 0;

        return { pieData, income, expenses, ratio, count: filtered.length };
    }, [entries, targetMonth]);

    const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: baseCurrency, minimumFractionDigits: 0 });

    return (
        <div className="glass p-6 rounded-3xl border border-gray-200 dark:border-white/10 col-span-1 lg:col-span-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LucidePieChart className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Monthly Analysis</span>
                </div>
                <div className="flex items-center gap-2 glass px-2 py-1 rounded-full text-[10px] font-bold">
                    <button onClick={() => setMonthOffset(o => o - 1)} className="hover:text-purple-400 p-0.5"><LucideChevronLeft className="w-3 h-3" /></button>
                    <span className="min-w-[80px] text-center uppercase tracking-tighter">{format(targetMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setMonthOffset(o => o + 1)} className="hover:text-purple-400 p-0.5"><LucideChevronRight className="w-3 h-3" /></button>
                </div>
            </div>

            {monthData.count === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic py-12">
                    No data for this period
                </div>
            ) : (
                <>
                    {/* Ratio metric */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                                <LucideTrendingUp className="w-2.5 h-2.5 text-green-400" /> Income
                            </div>
                            <div className="text-sm font-bold text-green-400">{fmt(monthData.income)}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1">
                                <LucideTrendingDown className="w-2.5 h-2.5 text-red-400" /> Spent
                            </div>
                            <div className="text-sm font-bold text-red-400">{fmt(monthData.expenses)}</div>
                        </div>
                    </div>

                    <div className="relative h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={monthData.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {monthData.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any) => fmt(Number(value))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold">Inc/Exp Ratio</div>
                            <div className={`text-lg font-black ${monthData.ratio >= 100 ? 'text-green-400' : 'text-amber-400'}`}>
                                {Math.round(monthData.ratio)}%
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                        {monthData.pieData.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                    <span className="text-slate-300 truncate max-w-[100px]">{cat.name}</span>
                                </div>
                                <div className="font-mono text-slate-400">
                                    {fmt(cat.value)}
                                    <span className="ml-1 opacity-40 text-[8px]">
                                        ({Math.round(cat.value / monthData.expenses * 100)}%)
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
