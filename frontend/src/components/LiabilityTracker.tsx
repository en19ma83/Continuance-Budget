import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useEntity } from '../contexts/EntityContext';
import { LucideCreditCard, LucideHome, LucideTrendingDown, LucideChevronDown, LucideChevronUp } from 'lucide-react';

type LiabilityItem = {
  id: string;
  name: string;
  type: 'credit_card' | 'mortgage' | 'loan';
  balance: number;
  credit_limit?: number | null;
  utilisation?: number | null;
  interest_rate?: number | null;
  lvr?: number | null;
  balance_tracking_method?: string;
  projected_this_period?: number | null;
  statement_due_date?: string | null;
};

export function LiabilityTracker({
  token,
  baseCurrency = 'AUD',
}: {
  token: string | null;
  baseCurrency?: string;
}) {
  const { activeEntities } = useEntity();
  const [items, setItems] = useState<LiabilityItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLiabilities = () => {
    const params = new URLSearchParams();
    activeEntities.forEach(e => params.append('entities', e));
    if (activeEntities.size === 0) { setItems([]); setLoading(false); return; }
    fetch(`${API_BASE}/api/liabilities/summary?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchLiabilities();
  }, [activeEntities, token]);

  if (loading || items.length === 0) return null;

  const totalLiabilities = items.reduce((sum, i) => sum + i.balance, 0);

  const fmt = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: baseCurrency });

  const typeIcon = (type: LiabilityItem['type']) => {
    if (type === 'credit_card') return <LucideCreditCard className="w-4 h-4" />;
    if (type === 'mortgage') return <LucideHome className="w-4 h-4" />;
    return <LucideTrendingDown className="w-4 h-4" />;
  };

  const utilisationColour = (u: number) => {
    if (u >= 80) return 'bg-red-500';
    if (u >= 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="glass p-6 rounded-3xl border border-red-500/20 bg-red-500/5 col-span-1 md:col-span-3 animate-in fade-in duration-500">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <LucideTrendingDown className="w-4 h-4 text-red-400" />
          <div className="text-xs font-bold uppercase tracking-widest text-red-400">Liability Tracker</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-2xl font-black text-red-300">{fmt(totalLiabilities)}</div>
          {expanded ? <LucideChevronUp className="w-4 h-4 text-slate-500" /> : <LucideChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          {items.map(item => (
            <div key={item.id} className="bg-black/20 rounded-2xl p-4 flex flex-col gap-2">
              {/* Row 1: icon + name + balance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg">
                    {typeIcon(item.type)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {item.type === 'credit_card' ? 'Credit Card'
                        : item.type === 'mortgage' ? 'Mortgage'
                        : 'Loan'}
                      {item.interest_rate ? ` · ${item.interest_rate}% p.a.` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-red-300">{fmt(item.balance)}</div>
                  {item.credit_limit && (
                    <div className="text-[10px] text-slate-500">of {fmt(item.credit_limit)} limit</div>
                  )}
                </div>
              </div>

              {/* Utilisation bar (CC only) */}
              {item.credit_limit && item.utilisation !== null && item.utilisation !== undefined && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Utilisation</span>
                    <span className={item.utilisation >= 80 ? 'text-red-400 font-bold' : ''}>{item.utilisation}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${utilisationColour(item.utilisation)}`}
                      style={{ width: `${Math.min(item.utilisation, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* LVR bar (mortgage only) */}
              {item.lvr !== null && item.lvr !== undefined && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>LVR</span>
                    <span className={item.lvr >= 80 ? 'text-amber-400 font-bold' : ''}>{item.lvr}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${utilisationColour(item.lvr)}`}
                      style={{ width: `${Math.min(item.lvr, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CC statement forecast */}
              {item.type === 'credit_card' && item.projected_this_period !== null && item.projected_this_period !== undefined && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5 pt-2">
                  <span>Projected spend this statement</span>
                  <span className="text-amber-400 font-semibold">{fmt(item.projected_this_period)}</span>
                </div>
              )}
              {item.statement_due_date && (
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Next payment due</span>
                  <span>{new Date(item.statement_due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
