import { useState, useRef } from 'react';
import { useEntity } from '../contexts/EntityContext';
import { API_BASE } from '../utils/api';
import {
    LucideUpload, LucideArrowRight, LucideArrowLeft,
    LucideCheck, LucideFileText, LucideAlertCircle
} from 'lucide-react';

// ─── CSV parser (handles quoted fields) ──────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQ = false;
        for (const ch of line) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(line => {
        const vals = parseRow(line);
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
    return { headers, rows };
}

function parseAmount(raw: string | undefined): number | null {
    if (!raw) return null;
    const clean = raw.replace(/[$,\s]/g, '').trim();
    if (!clean || clean === 'nan' || clean === '-' || clean === '') return null;
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
}

// ─── Reusable column selector ─────────────────────────────────────────────────
function ColSelect({ label, value, onChange, headers }: {
    label: string; value: string; onChange: (v: string) => void; headers: string[];
}) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-white dark:bg-[#2d2d30] border border-gray-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#cccccc] outline-none focus:ring-1 focus:ring-blue-500"
            >
                <option value="">— select column —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
        </div>
    );
}

const STEPS = ['Upload', 'Map Columns', 'Done'];

export function ImportWizard({
    onComplete,
    token,
}: {
    onComplete: (stats: { imported: number; duplicates: number }) => void;
    token: string | null;
}) {
    const { activeEntities } = useEntity();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
    const [totalRows, setTotalRows] = useState(0);

    // Account / entity
    const [entity, setEntity] = useState<'PERSONAL' | 'BUSINESS'>(
        (Array.from(activeEntities)[0] as 'PERSONAL' | 'BUSINESS') || 'PERSONAL'
    );
    const [accounts, setAccounts] = useState<any[]>([]);
    const [accountId, setAccountId] = useState('');

    // Column mapping
    const [dateCol, setDateCol] = useState('');
    const [descCol, setDescCol] = useState('');
    const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
    const [amountCol, setAmountCol] = useState('');
    const [debitCol, setDebitCol] = useState('');
    const [creditCol, setCreditCol] = useState('');

    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null);

    // ── Auto-detect columns from headers ──────────────────────────────────────
    const autoDetect = (hdrs: string[]) => {
        const lower = hdrs.map(h => h.toLowerCase().trim());
        const find = (...terms: string[]) => {
            const idx = lower.findIndex(h => terms.some(t => h.includes(t)));
            return idx >= 0 ? hdrs[idx] : '';
        };

        setDateCol(find('date'));
        setDescCol(find('desc', 'narr', 'memo', 'particular', 'detail', 'reference', 'payee', 'transaction'));

        const debitIdx = lower.findIndex(h => h === 'debit' || h === 'dr' || h.startsWith('debit'));
        const creditIdx = lower.findIndex(h => h === 'credit' || h === 'cr' || h.startsWith('credit'));

        if (debitIdx >= 0 && creditIdx >= 0) {
            setAmountMode('split');
            setDebitCol(hdrs[debitIdx]);
            setCreditCol(hdrs[creditIdx]);
            setAmountCol('');
        } else {
            setAmountMode('single');
            setAmountCol(find('amount', 'amt', 'value', 'sum'));
            setDebitCol('');
            setCreditCol('');
        }
    };

    // ── Handle file selection ─────────────────────────────────────────────────
    const handleFileSelect = async (f: File) => {
        const text = await f.text();
        const { headers, rows } = parseCSV(text);
        const lineCount = Math.max(0, text.trim().split(/\r?\n/).length - 1);

        setFile(f);
        setHeaders(headers);
        setPreviewRows(rows.slice(0, 5));
        setTotalRows(lineCount);
        autoDetect(headers);

        // Load accounts for this user
        const params = new URLSearchParams();
        activeEntities.forEach(e => params.append('entities', e));
        fetch(`${API_BASE}/api/accounts?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                setAccounts(data);
                if (data.length > 0) setAccountId(data[0].id);
            })
            .catch(() => {});

        setStep(1);
    };

    // ── Compute live preview with current mapping ─────────────────────────────
    const parsedPreview = previewRows.map(row => {
        let amount: number | null = null;
        if (amountMode === 'split') {
            const d = parseAmount(row[debitCol]);
            const c = parseAmount(row[creditCol]);
            if (d !== null || c !== null) amount = (c ?? 0) - (d ?? 0);
        } else {
            amount = parseAmount(row[amountCol]);
        }
        return { date: row[dateCol] ?? '', description: row[descCol] ?? '', amount };
    });

    const canImport =
        !!dateCol && !!descCol && !!accountId &&
        (amountMode === 'single' ? !!amountCol : !!debitCol && !!creditCol);

    // ── Submit import ─────────────────────────────────────────────────────────
    const handleImport = async () => {
        if (!file || !canImport) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity', entity);
        formData.append('account_id', accountId);
        formData.append('date_col', dateCol);
        formData.append('desc_col', descCol);
        formData.append('amount_mode', amountMode);
        formData.append('amount_col', amountCol);
        formData.append('debit_col', debitCol);
        formData.append('credit_col', creditCol);

        try {
            const resp = await fetch(`${API_BASE}/api/recon/import`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await resp.json();
            setImportResult(data);
            setStep(2);
            onComplete(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
        }
    };

    const reset = () => {
        setStep(0); setFile(null); setHeaders([]);
        setPreviewRows([]); setTotalRows(0); setImportResult(null);
        setDateCol(''); setDescCol(''); setAmountCol('');
        setDebitCol(''); setCreditCol(''); setAmountMode('single');
    };

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            {step > 0 && (
                <div className="flex items-center gap-1 mb-1">
                    {STEPS.map((label, i) => (
                        <div key={i} className="flex items-center gap-1">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                                i < step   ? 'bg-green-500 text-white' :
                                i === step ? 'bg-blue-500 text-white' :
                                             'bg-gray-200 dark:bg-white/10 text-slate-500'
                            }`}>
                                {i < step ? <LucideCheck className="w-3 h-3" /> : i + 1}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${i === step ? 'text-blue-400' : 'text-slate-500'}`}>
                                {label}
                            </span>
                            {i < STEPS.length - 1 && <div className="w-3 h-px bg-gray-300 dark:bg-white/10 mx-1" />}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Step 0: Upload drop zone ── */}
            {step === 0 && (
                <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                        isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-200 dark:border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5'
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                    <LucideUpload className="w-8 h-8 mx-auto mb-3 text-slate-400" />
                    <div className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">
                        Drop CSV bank statement here
                    </div>
                    <p className="text-xs text-slate-500">
                        or click to browse · supports single-amount and debit/credit column formats
                    </p>
                </div>
            )}

            {/* ── Step 1: Map columns ── */}
            {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* File banner */}
                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <LucideFileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-blue-300 truncate">{file?.name}</div>
                            <div className="text-[10px] text-slate-500">
                                {totalRows} rows · {headers.length} columns detected
                            </div>
                        </div>
                        <button onClick={reset} className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 underline shrink-0">
                            Change file
                        </button>
                    </div>

                    {/* Account + entity */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Entity</label>
                            <select
                                value={entity}
                                onChange={e => setEntity(e.target.value as 'PERSONAL' | 'BUSINESS')}
                                className="w-full bg-white dark:bg-[#2d2d30] border border-gray-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#cccccc] outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="PERSONAL">Personal</option>
                                <option value="BUSINESS">Business</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Import to Account</label>
                            <select
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                className="w-full bg-white dark:bg-[#2d2d30] border border-gray-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-[#cccccc] outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">Select account…</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Column mapping */}
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Column Mapping</div>
                        <div className="grid grid-cols-2 gap-3">
                            <ColSelect label="Date Column" value={dateCol} onChange={setDateCol} headers={headers} />
                            <ColSelect label="Description Column" value={descCol} onChange={setDescCol} headers={headers} />
                        </div>

                        {/* Amount format toggle */}
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Amount Format</div>
                            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 p-0.5 bg-gray-100 dark:bg-black/20 mb-3">
                                {(['single', 'split'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setAmountMode(mode)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                                            amountMode === mode
                                                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-400'
                                        }`}
                                    >
                                        {mode === 'single' ? 'Single Column (±)' : 'Debit / Credit Columns'}
                                    </button>
                                ))}
                            </div>
                            {amountMode === 'single' ? (
                                <ColSelect label="Amount Column" value={amountCol} onChange={setAmountCol} headers={headers} />
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <ColSelect label="Debit Column (money out, positive)" value={debitCol} onChange={setDebitCol} headers={headers} />
                                    <ColSelect label="Credit Column (money in, positive)" value={creditCol} onChange={setCreditCol} headers={headers} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live preview table */}
                    {parsedPreview.some(r => r.date) && (
                        <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 py-2 bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5">
                                Preview — first {previewRows.length} rows
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-white/5">
                                {parsedPreview.map((row, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                                        <div className="text-slate-400 w-24 shrink-0 font-mono">{row.date || '—'}</div>
                                        <div className="flex-1 truncate text-gray-700 dark:text-slate-300">{row.description || '—'}</div>
                                        <div className={`font-mono font-semibold w-24 text-right shrink-0 ${
                                            row.amount === null ? 'text-slate-500 italic' :
                                            row.amount > 0 ? 'text-green-500' : 'text-red-400'
                                        }`}>
                                            {row.amount === null
                                                ? 'unmapped'
                                                : `${row.amount > 0 ? '+' : ''}${row.amount.toFixed(2)}`
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!canImport && (
                        <div className="flex items-center gap-2 text-[10px] text-amber-500">
                            <LucideAlertCircle className="w-3 h-3 shrink-0" />
                            Map all required columns and select an account to continue.
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={reset}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-white/5 text-slate-500 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                            <LucideArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!canImport || isUploading}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isUploading
                                ? 'Importing…'
                                : <><span>Import {totalRows} Rows</span><LucideArrowRight className="w-4 h-4" /></>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Result ── */}
            {step === 2 && importResult && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 rounded-2xl border border-green-500/30 bg-green-500/5 text-center">
                        <LucideCheck className="w-8 h-8 text-green-400 mx-auto mb-3" />
                        <div className="font-bold text-lg text-green-400 mb-1">Import Complete</div>
                        <div className="text-sm text-slate-400">
                            <span className="font-bold text-green-300">{importResult.imported}</span> rows imported
                            {importResult.duplicates > 0 && (
                                <> · <span className="text-slate-500">{importResult.duplicates} duplicates skipped</span></>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={reset}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-white/5 text-slate-500 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                    >
                        Import Another Statement
                    </button>
                </div>
            )}
        </div>
    );
}
