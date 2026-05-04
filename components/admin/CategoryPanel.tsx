import React, { useState, useRef } from 'react';
import { StoreSettings } from '../../types';
import { Plus, Trash2, Edit, Check, GripVertical, ListPlus, AlertTriangle, X } from 'lucide-react';

interface CategoryPanelProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CategoryItem {
  id: string;
  name: string;
  isCustom?: boolean;
}

export const CategoryPanel: React.FC<CategoryPanelProps> = ({ settings, setSettings, notify }) => {
  const [activeCategoryId, setActiveCategoryId] = useState('brands');
  const [newItem, setNewItem] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingItem, setEditingItem] = useState<{ original: string; current: string } | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [confirmEdit, setConfirmEdit] = useState({ isOpen: false, original: '', current: '' });
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean; type: 'item' | 'category'; categoryId?: string; value: string;
  }>({ isOpen: false, type: 'item', value: '' });
  const [deleteInput, setDeleteInput] = useState('');

  const coreCategories: CategoryItem[] = [
    { id: 'brands', name: '১. ব্র্যান্ড' },
    { id: 'colors', name: '২. কালার লিস্ট' },
    { id: 'thicknesses', name: '৩. থিকনেস / সাইজ' },
    { id: 'productTypes', name: '৪. পণ্যের ধরন (Type)' },
  ];
  const allCategories: CategoryItem[] = [
    ...coreCategories,
    ...(settings.customFields || []).map(f => ({ id: f.id, name: f.name, isCustom: true })),
  ];

  const isCore = (id: string) => ['brands', 'colors', 'thicknesses', 'productTypes'].includes(id);

  const getCurrentOptions = (): string[] => {
    if (isCore(activeCategoryId)) return settings[activeCategoryId as keyof StoreSettings] as string[];
    return settings.customFields.find(f => f.id === activeCategoryId)?.options || [];
  };

  const setCurrentOptions = (list: string[]) => {
    if (isCore(activeCategoryId)) {
      setSettings(prev => ({ ...prev, [activeCategoryId]: list }));
    } else {
      setSettings(prev => ({
        ...prev,
        customFields: prev.customFields.map(f => f.id === activeCategoryId ? { ...f, options: list } : f),
      }));
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) { notify('ক্যাটাগরির নাম লিখুন', 'error'); return; }
    const newId = `custom_${Date.now()}`;
    setSettings(prev => ({ ...prev, customFields: [...(prev.customFields || []), { id: newId, name: newCategoryName, options: [] }] }));
    notify('নতুন ক্যাটাগরি তৈরি হয়েছে', 'success');
    setNewCategoryName(''); setIsAddingCategory(false); setActiveCategoryId(newId);
  };

  const handleAddItem = () => {
    if (!newItem.trim()) { notify('আইটেমের নাম লিখুন', 'error'); return; }
    if (getCurrentOptions().includes(newItem.trim())) { notify('এই নামটি ইতিমধ্যেই আছে', 'error'); return; }
    setCurrentOptions([...getCurrentOptions(), newItem.trim()]);
    notify(`${newItem} যোগ হয়েছে`, 'success');
    setNewItem('');
  };

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const list = [...getCurrentOptions()];
    const dragged = list[dragItem.current];
    list.splice(dragItem.current, 1);
    list.splice(dragOverItem.current, 0, dragged);
    setCurrentOptions(list);
    dragItem.current = null; dragOverItem.current = null;
  };

  const initiateSaveEdit = () => {
    if (!editingItem?.current.trim()) return;
    if (editingItem.original === editingItem.current) { setEditingItem(null); return; }
    if (getCurrentOptions().includes(editingItem.current.trim())) { notify('এই নামটি ইতিমধ্যে আছে', 'error'); return; }
    setConfirmEdit({ isOpen: true, original: editingItem.original, current: editingItem.current });
  };

  const executeSaveEdit = () => {
    setCurrentOptions(getCurrentOptions().map(i => i === confirmEdit.original ? confirmEdit.current.trim() : i));
    setEditingItem(null);
    setConfirmEdit({ isOpen: false, original: '', current: '' });
    notify('আপডেট সফল হয়েছে', 'success');
  };

  const executeDelete = () => {
    const { type, categoryId, value } = confirmDelete;
    if (deleteInput !== value) { notify('নাম সঠিক নয়! দয়া করে হুবহু নাম লিখুন।', 'error'); return; }
    if (type === 'item') {
      setCurrentOptions(getCurrentOptions().filter(i => i !== value));
      notify(`${value} ডিলিট করা হয়েছে`, 'success');
    } else if (type === 'category' && categoryId) {
      setSettings(prev => ({ ...prev, customFields: prev.customFields.filter(f => f.id !== categoryId) }));
      setActiveCategoryId('brands');
      notify(`ক্যাটাগরি '${value}' ডিলিট হয়েছে`, 'success');
    }
    setConfirmDelete({ isOpen: false, type: 'item', value: '' }); setDeleteInput('');
  };

  return (
    <div className="relative">
      {/* Delete Confirmation Modal */}
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border-2 border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">সতর্কতা! ডিলিট নিশ্চিত করুন</h3>
            <p className="text-slate-600 mb-4 text-sm">
              এটি ডিলিট করলে সমস্যা হতে পারে। নিশ্চিত করতে <span className="font-bold text-red-600 bg-red-50 px-1 rounded">"{confirmDelete.value}"</span> লিখুন।
            </p>
            <input type="text" className="w-full p-3 border-2 border-red-200 rounded-xl text-center font-bold mb-6 focus:border-red-600 outline-none" placeholder="নামটি এখানে লিখুন" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ ...confirmDelete, isOpen: false })} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">বাতিল</button>
              <button onClick={executeDelete} disabled={deleteInput !== confirmDelete.value} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">ডিলিট করুন</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {confirmEdit.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border border-blue-100">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Edit className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">পরিবর্তন নিশ্চিত করুন</h3>
            <div className="bg-slate-50 p-4 rounded-xl mb-6 text-sm">
              <div className="flex justify-between text-slate-500 mb-2"><span>পুরাতন নাম:</span><span className="font-bold line-through">{confirmEdit.original}</span></div>
              <div className="flex justify-between text-blue-600"><span className="font-bold">নতুন নাম:</span><span className="font-bold text-lg">{confirmEdit.current}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEdit({ ...confirmEdit, isOpen: false })} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">না</button>
              <button onClick={executeSaveEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">হ্যাঁ, সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Category Sidebar */}
        <div className="md:col-span-4 space-y-2">
          <div className="flex justify-between items-center mb-2 px-2">
            <p className="text-xs font-bold text-slate-400 uppercase">ক্যাটাগরি তালিকা</p>
            <button onClick={() => setIsAddingCategory(true)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><ListPlus className="w-5 h-5" /></button>
          </div>

          {isAddingCategory && (
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 mb-4 animate-fade-in">
              <input className="w-full p-2 border border-blue-300 rounded mb-2 text-sm" placeholder="নতুন ক্যাটাগরির নাম (উদাঃ গ্রেড)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={handleAddCategory} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded font-bold">তৈরি করুন</button>
                <button onClick={() => setIsAddingCategory(false)} className="flex-1 bg-white text-slate-600 text-xs py-2 rounded font-bold border">বাতিল</button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {allCategories.map(cat => (
              <div key={cat.id} className="group relative">
                <button
                  onClick={() => { setActiveCategoryId(cat.id); setEditingItem(null); }}
                  className={`w-full text-left px-4 py-3 rounded-xl font-bold border transition ${activeCategoryId === cat.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                >
                  {cat.name}
                </button>
                {cat.isCustom && (
                  <button
                    onClick={() => { setDeleteInput(''); setConfirmDelete({ isOpen: true, type: 'category', categoryId: cat.id, value: cat.name }); }}
                    className="absolute right-2 top-3 text-slate-300 hover:text-red-500 bg-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Items Area */}
        <div className="md:col-span-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 min-h-[400px]">
          <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex justify-between">
            <span>{allCategories.find(c => c.id === activeCategoryId)?.name} এর অপশন সমূহ</span>
            <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">{getCurrentOptions().length} টি</span>
          </h3>

          <div className="flex gap-2 mb-6">
            <input className="flex-1 p-3 rounded-xl border border-slate-300" placeholder="নতুন আইটেম লিখুন..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem()} />
            <button onClick={handleAddItem} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg">যোগ করুন</button>
          </div>

          <p className="text-xs text-slate-400 mb-2 italic">টিপস: অপশনগুলো মাউস দিয়ে টেনে (Drag & Drop) সাজাতে পারেন।</p>

          <div className="flex flex-wrap gap-2">
            {getCurrentOptions().map((item, idx) => (
              <div
                key={idx}
                className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold flex items-center gap-2 shadow-sm group hover:border-blue-300 transition cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => (dragItem.current = idx)}
                onDragEnter={() => (dragOverItem.current = idx)}
                onDragEnd={handleDragSort}
                onDragOver={e => e.preventDefault()}
              >
                <GripVertical className="w-4 h-4 text-slate-300 mr-1" />
                {editingItem?.original === item ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="w-32 p-1 text-sm border-b-2 border-blue-500 outline-none bg-blue-50"
                      value={editingItem.current}
                      onChange={e => setEditingItem({ ...editingItem, current: e.target.value })}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && initiateSaveEdit()}
                    />
                    <button onClick={initiateSaveEdit} className="text-green-600 bg-green-50 p-1 rounded hover:bg-green-100"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingItem(null)} className="text-slate-400 p-1 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    {item}
                    <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setEditingItem({ original: item, current: item })} className="text-slate-300 hover:text-blue-500 p-1 hover:bg-blue-50 rounded"><Edit className="w-3 h-3" /></button>
                      <button onClick={() => { setDeleteInput(''); setConfirmDelete({ isOpen: true, type: 'item', categoryId: activeCategoryId, value: item }); }} className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
