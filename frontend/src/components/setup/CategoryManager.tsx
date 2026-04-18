import { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/api';
import { LucidePlus, LucideX, Trash2, ChevronDown, ChevronRight, Edit3 } from 'lucide-react';

type Category = { id: string; name: string; color: string | null; group_id: string };
type CategoryGroup = { id: string; name: string; type: string; categories: Category[] };

const TYPE_OPTIONS = ['EXPENSE', 'INCOME', 'TRANSFER'];
const TYPE_COLORS: Record<string, string> = {
  EXPENSE: 'text-red-400',
  INCOME: 'text-green-400',
  TRANSFER: 'text-blue-400',
};

export function CategoryManager({ token }: { token: string | null }) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('EXPENSE');

  // New category form (per group)
  const [addingCatToGroup, setAddingCatToGroup] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Edit category
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; color: string; group_id: string } | null>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchGroups = () => {
    fetch(`${API_BASE}/api/categories/groups`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setGroups(data))
      .catch(console.error);
  };

  useEffect(() => { if (token) fetchGroups(); }, [token]);

  const toggleExpand = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await fetch(`${API_BASE}/api/categories/groups`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: newGroupName.trim(), type: newGroupType }),
    });
    setNewGroupName('');
    setShowNewGroup(false);
    fetchGroups();
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}" and all its categories? This cannot be undone.`)) return;
    await fetch(`${API_BASE}/api/categories/groups/${id}`, { method: 'DELETE', headers });
    fetchGroups();
  };

  const handleCreateCategory = async (groupId: string) => {
    if (!newCatName.trim()) return;
    await fetch(`${API_BASE}/api/categories`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: newCatName.trim(), group_id: groupId, color: newCatColor }),
    });
    setNewCatName('');
    setAddingCatToGroup(null);
    fetchGroups();
  };

  const handleUpdateCategory = async () => {
    if (!editingCat || !editingCat.name.trim()) return;
    await fetch(`${API_BASE}/api/categories/${editingCat.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ name: editingCat.name.trim(), group_id: editingCat.group_id, color: editingCat.color }),
    });
    setEditingCat(null);
    fetchGroups();
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    await fetch(`${API_BASE}/api/categories/${id}`, { method: 'DELETE', headers });
    fetchGroups();
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Categories</h3>
        <button
          onClick={() => setShowNewGroup(!showNewGroup)}
          className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-full transition-colors"
          title="Add category group"
        >
          {showNewGroup ? <LucideX className="w-4 h-4" /> : <LucidePlus className="w-4 h-4 text-purple-400" />}
        </button>
      </div>

      {showNewGroup && (
        <div className="glass p-3 rounded-xl border border-purple-500/30 space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">New Group</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newGroupType}
              onChange={e => setNewGroupType(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={handleCreateGroup}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-1.5 rounded-lg text-sm transition-colors"
          >
            Create Group
          </button>
        </div>
      )}

      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.id} className="glass rounded-xl border border-white/10 overflow-hidden">
            {/* Group header */}
            <div
              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => toggleExpand(group.id)}
            >
              <div className="flex items-center gap-2">
                {expandedGroups.has(group.id)
                  ? <ChevronDown className="w-3 h-3 text-slate-500" />
                  : <ChevronRight className="w-3 h-3 text-slate-500" />}
                <span className="text-sm font-semibold">{group.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[group.type] || 'text-slate-500'}`}>
                  {group.type}
                </span>
                <span className="text-[10px] text-slate-500">{group.categories.length} cat.</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); setAddingCatToGroup(group.id); setExpandedGroups(prev => new Set([...prev, group.id])); }}
                  className="p-1 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                  title="Add category"
                >
                  <LucidePlus className="w-3 h-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteGroup(group.id, group.name); }}
                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete group"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {expandedGroups.has(group.id) && (
              <div className="border-t border-white/5 px-3 py-2 space-y-1">
                {/* Add category inline form */}
                {addingCatToGroup === group.id && (
                  <div className="flex items-center gap-2 mb-2 animate-in fade-in">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={e => setNewCatColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      placeholder="Category name"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateCategory(group.id)}
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs"
                      autoFocus
                    />
                    <button onClick={() => handleCreateCategory(group.id)} className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded-lg transition-colors">Add</button>
                    <button onClick={() => setAddingCatToGroup(null)} className="text-xs text-slate-500 hover:text-white px-1 py-1 rounded transition-colors"><LucideX className="w-3 h-3" /></button>
                  </div>
                )}

                {group.categories.length === 0 && addingCatToGroup !== group.id && (
                  <div className="text-xs text-slate-500 italic py-1">No categories — click + to add one.</div>
                )}

                {group.categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between py-0.5 group/cat">
                    {editingCat?.id === cat.id ? (
                      <div className="flex items-center gap-2 flex-1 animate-in fade-in">
                        <input
                          type="color"
                          value={editingCat.color || '#6366f1'}
                          onChange={e => setEditingCat(prev => prev ? { ...prev, color: e.target.value } : prev)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          value={editingCat.name}
                          onChange={e => setEditingCat(prev => prev ? { ...prev, name: e.target.value } : prev)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdateCategory()}
                          className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-0.5 text-xs"
                          autoFocus
                        />
                        <button onClick={handleUpdateCategory} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded transition-colors hover:bg-blue-600">Save</button>
                        <button onClick={() => setEditingCat(null)} className="text-xs text-slate-500 hover:text-white"><LucideX className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          )}
                          <span className="text-xs">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingCat({ id: cat.id, name: cat.name, color: cat.color || '#6366f1', group_id: cat.group_id })}
                            className="p-1 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
