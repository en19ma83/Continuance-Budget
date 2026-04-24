import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, startOfMonth, addMonths, isSameMonth, parseISO } from 'date-fns';
import { LucideChevronLeft, LucideChevronRight, LucideTrendingUp, LucideTrendingDown, LucidePieChart } from 'lucide-react';

type LedgerEntry = {
    date: string;
    amount: number;
    category_name?: string;
    category_color?: string;
    account_type?: string;
    category_group_type?: string;
    rule_id?: string;
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

    // Heuristic: identify transfer pairs (entries sharing rule_id and date)
    const transferRuleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(e => {
            if (e.rule_id) {
                const key = `${e.rule_id}-${e.date}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return counts;
    }, [entries]);

    const monthData = useMemo(() => {
        const start = targetMonth;

        const filtered = entries.filter(e => {
            const d = parseISO(e.date);
            // EXCLUDE:
            // 1. Transactions categorized in the 'TRANSFER' group
            // 2. Positive integers on Credit Card accounts (these are debt repayments, not income)
            // 3. Transactions that are part of a transfer pair (identified by rule_id + date)
            const cgType = e.category_group_type?.toUpperCase();
            const isTransferPair = e.rule_id && transferRuleCounts[`${e.rule_id}-${e.date}`] > 1;
            
            // Exclude anything explicitly in TRANSFER group, OR with "transfer" or "payment" in the name, OR part of a rule-based pair
            const isTransferGroup = 
                cgType === 'TRANSFER' || 
                e.category_name?.toLowerCase().includes('transfer') || 
                e.category_name?.toLowerCase().includes('payment') ||
                !!isTransferPair;

            const isCCRepayment = e.account_type === 'Credit Card' && e.amount > 0;

            // 1. Genuine income: Either explicitly categorized as INCOME, or any positive amount that isn't a transfer/repayment
            const isGenuineIncome = cgType === 'INCOME' || (e.amount > 0 && !isTransferGroup && !isCCRepayment);
            
            // 2. Genuine spend: Anything negative that isn't a transfer
            const isGenuineSpend = e.amount < 0 && !isTransferGroup;

            return isSameMonth(d, start) && (isGenuineIncome || isGenuineSpend) && !isCCRepayment;
        });

        let income = 0;
        let expenses = 0;
        const categoryMap: Record<string, { name: string; value: number; color: string }> = {};

        filtered.forEach(e => {
            if (e.category_group_type?.toUpperCase() === 'INCOME') {
                income += e.amount;
            } else {
                // If it passed the filter and isn't income group, it represents spend (including uncategorized)
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
        <div className="glass p-8 rounded-3xl border border-gray-200 dark:border-white/10 col-span-1 md:col-span-3 flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LucidePieChart className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-bold uppercase tracking-widest text-purple-400">Monthly Analysis</span>
                </div>
                <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-bold">
                    <button onClick={() => setMonthOffset(o => o - 1)} className="hover:text-purple-400 p-0.5 transition-colors"><LucideChevronLeft className="w-4 h-4" /></button>
                    <span className="min-w-[120px] text-center uppercase tracking-tighter">{format(targetMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setMonthOffset(o => o + 1)} className="hover:text-purple-400 p-0.5 transition-colors"><LucideChevronRight className="w-4 h-4" /></button>
                </div>
            </div>

            {monthData.count === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic py-20">
                    No data available for this period (transfers excluded)
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                    {/* Metrics Section */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 group hover:border-green-500/30 transition-all duration-300">
                            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <LucideTrendingUp className="w-3 h-3 text-green-400" /> Monthly Income
                            </div>
                            <div className="text-2xl font-black text-green-400 group-hover:scale-105 transition-transform origin-left">{fmt(monthData.income)}</div>
                        </div>
                        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 group hover:border-red-500/30 transition-all duration-300">
                            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <LucideTrendingDown className="w-3 h-3 text-red-400" /> Monthly Spend
                            </div>
                            <div className="text-2xl font-black text-red-400 group-hover:scale-105 transition-transform origin-left">{fmt(monthData.expenses)}</div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="lg:col-span-5 relative h-64 lg:h-80 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={monthData.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={75}
                                    outerRadius={105}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {monthData.pieData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.color} 
                                            fillOpacity={0.9}
                                            className="hover:opacity-100 transition-opacity cursor-pointer outline-none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: 'none', borderRadius: '12px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    formatter={(value: any) => fmt(Number(value))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-[10px] uppercase tracking-tighter text-slate-500 font-bold">Inc/Exp Ratio</div>
                            <div className={`text-3xl font-black ${monthData.ratio >= 100 ? 'text-green-400' : 'text-amber-400'}`}>
                                {Math.round(monthData.ratio)}%
                            </div>
                            <div className="text-[8px] text-slate-600 font-medium">Excluded Transfers</div>
                        </div>
                    </div>

                    {/* Categories Section */}
                    <div className="lg:col-span-4 space-y-3 max-h-[320px] overflow-y-auto pr-4 custom-scrollbar">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-4 border-b border-white/5 pb-2">
                           Spend Breakdown
                        </div>
                        {monthData.pieData.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between group hover:bg-white/5 p-2 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full shadow-lg" style={{ backgroundColor: cat.color }} />
                                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors truncate max-w-[140px]">{cat.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{fmt(cat.value)}</div>
                                    <div className="text-[9px] text-slate-500 font-medium">
                                        {Math.round(cat.value / monthData.expenses * 100)}% of total
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}