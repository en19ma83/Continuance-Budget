import { useState } from 'react';
import { useEntity } from '../contexts/EntityContext';
import { API_BASE } from '../utils/api';

export function ImportWizard({ onComplete, token }: { onComplete: (stats: { imported: number, duplicates: number }) => void, token: string | null }) {
  const { activeEntities } = useEntity();
  const [file, setFile] = useState<File | null>(null);
  const [dateCol, setDateCol] = useState('Date');
  const [descCol, setDescCol] = useState('Description');
  const [amountCol, setAmountCol] = useState('Amount');
  const [isUploading, setIsUploading] = useState(false);
  const [entity, setEntity] = useState<string>(Array.from(activeEntities)[0] || 'PERSONAL');

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity', entity);
    formData.append('date_col', dateCol);
    formData.append('desc_col', descCol);
    formData.append('amount_col', amountCol);

    try {
      const resp = await fetch(`${API_BASE}/api/recon/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      onComplete(data);
      setFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center glass hover:border-blue-500/50 transition-colors">
        <input 
          type="file" 
          accept=".csv" 
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="hidden" 
          id="statement-upload" 
        />
        <label htmlFor="statement-upload" className="cursor-pointer">
          {file ? (
            <div className="text-blue-400 font-semibold">{file.name}</div>
          ) : (
            <div className="space-y-2">
              <div className="text-lg font-medium">Upload Bank Statement</div>
              <p className="text-sm text-slate-500">Drag & drop your CSV file here</p>
            </div>
          )}
        </label>
      </div>

      {file && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Column Mapping</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Entity</label>
              <select value={entity} onChange={e => setEntity(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date Column</label>
              <input type="text" value={dateCol} onChange={e => setDateCol(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Description Column</label>
              <input type="text" value={descCol} onChange={e => setDescCol(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Amount Column</label>
              <input type="text" value={amountCol} onChange={e => setAmountCol(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <button 
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Importing...' : 'Start Import'}
          </button>
        </div>
      )}
    </div>
  );
}
