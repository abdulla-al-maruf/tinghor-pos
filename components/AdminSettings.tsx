
import React, { useState, useContext, useRef } from 'react';
import { StoreSettings, User, UserSession } from '../types';
import { Settings, Plus, Trash2, User as UserIcon, Shield, Key, Hash, AlertTriangle, X, ListPlus, Edit, Save, Check, GripVertical, Laptop, Smartphone, Lock } from 'lucide-react';
import { ToastContext } from '../App';
import { generateId } from '../lib/utils';

interface AdminSettingsProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, setSettings, users, setUsers }) => {
  const { notify } = useContext(ToastContext);
  const [activeTab, setActiveTab] = useState<'store' | 'users' | 'system'>('store');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('brands');
  const [newItem, setNewItem] = useState('');
  
  // Custom Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Editing Item State
  const [editingItem, setEditingItem] = useState<{ original: string, current: string } | null>(null);
  
  // Drag State
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Edit Confirmation Modal State
  const [confirmEdit, setConfirmEdit] = useState<{
    isOpen: boolean;
    original: string;
    current: string;
  }>({ isOpen: false, original: '', current: '' });

  // Delete Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'item' | 'user' | 'category';
    categoryId?: string;
    value: string;
    id?: string;
  }>({ isOpen: false, type: 'item', value: '' });
  
  // Delete Input State (Safety)
  const [deleteInput, setDeleteInput] = useState('');

  // User Mgmt State
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager' as 'admin'|'manager' });
  const [selectedUserForDevices, setSelectedUserForDevices] = useState<User | null>(null);

  // --- Dynamic Categories Helpers ---
  const coreCategories = [
    { id: 'brands', name: '১. ব্র্যান্ড' }, 
    { id: 'colors', name: '২. কালার লিস্ট' },
    { id: 'thicknesses', name: '৩. থিকনেস / সাইজ' },
    { id: 'productTypes', name: '৪. পণ্যের ধরন (Type)' } 
  ];

  const allCategories = [
    ...coreCategories,
    ...(settings.customFields || []).map(f => ({ id: f.id, name: f.name, isCustom: true }))
  ];

  const getCurrentOptions = () => {
    if (['brands', 'colors', 'thicknesses', 'productTypes'].includes(activeCategoryId)) {
      return settings[activeCategoryId as keyof StoreSettings] as string[];
    }
    const field = settings.customFields.find(f => f.id === activeCategoryId);
    return field ? field.options : [];
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      notify('ক্যাটাগরির নাম লিখুন', 'error');
      return;
    }
    const newId = `custom_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      customFields: [...(prev.customFields || []), { id: newId, name: newCategoryName, options: [] }]
    }));
    notify('নতুন ক্যাটাগরি তৈরি হয়েছে', 'success');
    setNewCategoryName('');
    setIsAddingCategory(false);
    setActiveCategoryId(newId);
  };

  const handleAddItem = () => {
    if (!newItem.trim()) {
      notify('আইটেমের নাম লিখুন', 'error');
      return;
    }
    
    // Check duplicates
    const currentList = getCurrentOptions();
    if (currentList.includes(newItem.trim())) {
      notify('এই নামটি ইতিমধ্যেই আছে', 'error');
      return;
    }

    if (['brands', 'colors', 'thicknesses', 'productTypes'].includes(activeCategoryId)) {
      setSettings(prev => ({
        ...prev,
        [activeCategoryId]: [...prev[activeCategoryId as keyof StoreSettings] as string[], newItem.trim()]
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        customFields: prev.customFields.map(f => 
          f.id === activeCategoryId ? { ...f, options: [...f.options, newItem.trim()] } : f
        )
      }));
    }
    notify(`${newItem} যোগ হয়েছে`, 'success');
    setNewItem('');
  };

  // --- Drag and Drop Handlers ---
  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    const currentList = [...getCurrentOptions()];
    const draggedItemContent = currentList[dragItem.current];

    // Remove the item from original position
    currentList.splice(dragItem.current, 1);
    // Insert at new position
    currentList.splice(dragOverItem.current, 0, draggedItemContent);

    // Save to settings
    if (['brands', 'colors', 'thicknesses', 'productTypes'].includes(activeCategoryId)) {
      setSettings(prev => ({
        ...prev,
        [activeCategoryId]: currentList
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        customFields: prev.customFields.map(f => 
          f.id === activeCategoryId ? { ...f, options: currentList } : f
        )
      }));
    }

    // Reset refs
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const initiateEditItem = (item: string) => {
    setEditingItem({ original: item, current: item });
  };

  const initiateSaveEdit = () => {
    if (!editingItem || !editingItem.current.trim()) return;
    if (editingItem.original === editingItem.current) { setEditingItem(null); return; }

    const list = getCurrentOptions();
    if (list.includes(editingItem.current.trim())) { notify('এই নামটি ইতিমধ্যে আছে', 'error'); return; }

    setConfirmEdit({ isOpen: true, original: editingItem.original, current: editingItem.current });
  };

  const executeSaveEdit = () => {
    if (!confirmEdit.isOpen) return;

    if (['brands', 'colors', 'thicknesses', 'productTypes'].includes(activeCategoryId)) {
      setSettings(prev => ({
        ...prev,
        [activeCategoryId]: (prev[activeCategoryId as keyof StoreSettings] as string[]).map(i => i === confirmEdit.original ? confirmEdit.current.trim() : i)
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        customFields: prev.customFields.map(f => 
          f.id === activeCategoryId ? { ...f, options: f.options.map(o => o === confirmEdit.original ? confirmEdit.current.trim() : o) } : f
        )
      }));
    }
    setEditingItem(null);
    setConfirmEdit({ isOpen: false, original: '', current: '' });
    notify('আপডেট সফল হয়েছে', 'success');
  };

  const initiateDeleteItem = (item: string) => {
    setDeleteInput('');
    setConfirmDelete({ isOpen: true, type: 'item', categoryId: activeCategoryId, value: item });
  };

  const initiateDeleteCategory = (catId: string, catName: string) => {
    setDeleteInput('');
    setConfirmDelete({ isOpen: true, type: 'category', categoryId: catId, value: catName });
  };

  const handleDeleteUserClick = (user: User) => {
     setDeleteInput(''); 
     setConfirmDelete({ isOpen: true, type: 'user', value: user.name, id: user.id });
  };

  const executeDelete = () => {
     const { type, categoryId, value, id } = confirmDelete;

     if ((type === 'item' || type === 'category') && deleteInput !== value) {
        notify('নাম সঠিক নয়! দয়া করে হুবহু নাম লিখুন।', 'error');
        return;
     }

     if (type === 'item' && categoryId) {
        if (['brands', 'colors', 'thicknesses', 'productTypes'].includes(categoryId)) {
           const list = settings[categoryId as keyof StoreSettings] as string[];
           setSettings(prev => ({ ...prev, [categoryId]: list.filter(i => i !== value) }));
        } else {
           setSettings(prev => ({
             ...prev,
             customFields: prev.customFields.map(f => 
               f.id === categoryId ? { ...f, options: f.options.filter(o => o !== value) } : f
             )
           }));
        }
        notify(`${value} ডিলিট করা হয়েছে`, 'success');
     } 
     else if (type === 'category' && categoryId) {
        setSettings(prev => ({ ...prev, customFields: prev.customFields.filter(f => f.id !== categoryId) }));
        setActiveCategoryId('brands'); 
        notify(`ক্যাটাগরি '${value}' ডিলিট হয়েছে`, 'success');
     }
     else if (type === 'user' && id) {
        setUsers(users.filter(u => u.id !== id));
        notify(`ইউজার ${value} ডিলিট করা হয়েছে`, 'success');
     }
     setConfirmDelete({ isOpen: false, type: 'item', value: '' });
     setDeleteInput('');
  };

  // --- User & Session Logic ---
  const addUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
       notify('নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক', 'error');
       return;
    }
    const user: User = {
      id: generateId(),
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role,
      sessions: []
    };
    setUsers([...users, user]);
    setNewUser({ name: '', email: '', password: '', role: 'manager' });
    notify('নতুন ইউজার তৈরি হয়েছে', 'success');
  };

  const handleRevokeSession = (userId: string, sessionId: string) => {
     setUsers(prev => prev.map(u => {
        if(u.id === userId) {
           return { ...u, sessions: u.sessions.filter(s => s.sessionId !== sessionId) };
        }
        return u;
     }));
     notify('সেশন লগআউট করা হয়েছে', 'success');
  };

  const handleTrustDevice = (userId: string, sessionId: string) => {
    setUsers(prev => prev.map(u => {
       if(u.id === userId) {
          return { ...u, sessions: u.sessions.map(s => s.sessionId === sessionId ? {...s, isTrusted: !s.isTrusted} : s) };
       }
       return u;
    }));
    notify('ডিভাইস স্ট্যাটাস আপডেট হয়েছে', 'success');
 };

  return (
    <div className="font-bangla space-y-6 animate-fade-in relative">
       
       {/* DELETE Confirmation Modal (Strict) */}
       {confirmDelete.isOpen && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border-2 border-red-100">
               <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <AlertTriangle className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-2">সতর্কতা! ডিলিট নিশ্চিত করুন</h3>
               
               {confirmDelete.type === 'user' ? (
                  <p className="text-slate-600 mb-6">
                     আপনি ইউজার <span className="font-bold text-red-600">"{confirmDelete.value}"</span> রিমুভ করতে চাচ্ছেন?
                  </p>
               ) : (
                  <>
                     <p className="text-slate-600 mb-4 text-sm">
                        এটি ডিলিট করলে সফটওয়্যারের ডাটা এন্ট্রিতে সমস্যা হতে পারে। নিশ্চিত করতে নিচের বক্সে <span className="font-bold text-red-600 bg-red-50 px-1 rounded select-all">"{confirmDelete.value}"</span> লিখুন।
                     </p>
                     <input 
                        type="text" 
                        className="w-full p-3 border-2 border-red-200 rounded-xl text-center font-bold mb-6 focus:border-red-600 outline-none placeholder-red-200"
                        placeholder="নামটি এখানে লিখুন"
                        value={deleteInput}
                        onChange={e => setDeleteInput(e.target.value)}
                        autoFocus
                     />
                  </>
               )}

               <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete({...confirmDelete, isOpen: false})} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
                     বাতিল
                  </button>
                  <button 
                     onClick={executeDelete} 
                     disabled={confirmDelete.type !== 'user' && deleteInput !== confirmDelete.value}
                     className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                     ডিলিট করুন
                  </button>
               </div>
            </div>
         </div>
       )}

       {/* EDIT Confirmation Modal */}
       {confirmEdit.isOpen && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border border-blue-100">
               <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Edit className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-4">পরিবর্তন নিশ্চিত করুন</h3>
               <div className="bg-slate-50 p-4 rounded-xl mb-6 text-sm">
                  <div className="flex justify-between items-center text-slate-500 mb-2">
                     <span>পুরাতন নাম:</span>
                     <span className="font-bold text-slate-700 line-through">{confirmEdit.original}</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-600">
                     <span className="font-bold">নতুন নাম:</span>
                     <span className="font-bold text-lg">{confirmEdit.current}</span>
                  </div>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setConfirmEdit({...confirmEdit, isOpen: false})} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
                     না
                  </button>
                  <button onClick={executeSaveEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg transition">
                     হ্যাঁ, সেভ করুন
                  </button>
               </div>
            </div>
         </div>
       )}

       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex gap-4 border-b border-slate-100 pb-4 mb-6 overflow-x-auto">
             <button onClick={() => setActiveTab('store')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'store' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Settings className="w-5 h-5" /> পণ্য সেটিংস
             </button>
             <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Shield className="w-5 h-5" /> ইউজার ম্যানেজমেন্ট
             </button>
             <button onClick={() => setActiveTab('system')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'system' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Hash className="w-5 h-5" /> মেমো সেটিংস
             </button>
          </div>

          {activeTab === 'store' && (
             <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Sidebar Categories */}
                <div className="md:col-span-4 space-y-2">
                   <div className="flex justify-between items-center mb-2 px-2">
                      <p className="text-xs font-bold text-slate-400 uppercase">ক্যাটাগরি তালিকা</p>
                      <button onClick={() => setIsAddingCategory(true)} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                         <ListPlus className="w-5 h-5" />
                      </button>
                   </div>
                   
                   {isAddingCategory && (
                      <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 mb-4 animate-fade-in">
                         <input 
                           className="w-full p-2 border border-blue-300 rounded mb-2 text-sm" 
                           placeholder="নতুন ক্যাটাগরির নাম (উদাঃ গ্রেড)"
                           value={newCategoryName}
                           onChange={e => setNewCategoryName(e.target.value)}
                           autoFocus
                         />
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
                            {(cat as any).isCustom && (
                               <button 
                                 onClick={() => initiateDeleteCategory(cat.id, cat.name)}
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
                      <input 
                        className="flex-1 p-3 rounded-xl border border-slate-300" 
                        placeholder="নতুন আইটেম লিখুন..." 
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                      />
                      <button onClick={handleAddItem} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg">
                         যোগ করুন
                      </button>
                   </div>

                   <p className="text-xs text-slate-400 mb-2 italic">টিপস: অপশনগুলো মাউস দিয়ে টেনে (Drag & Drop) সাজাতে পারেন।</p>

                   <div className="flex flex-wrap gap-2">
                      {getCurrentOptions().map((item, idx) => (
                         <div 
                           key={idx} 
                           className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold flex items-center gap-2 shadow-sm group hover:border-blue-300 transition cursor-grab active:cursor-grabbing"
                           draggable
                           onDragStart={() => (dragItem.current = idx)}
                           onDragEnter={() => (dragOverItem.current = idx)}
                           onDragEnd={handleDragSort}
                           onDragOver={(e) => e.preventDefault()}
                         >
                            <GripVertical className="w-4 h-4 text-slate-300 mr-1" />
                            
                            {editingItem?.original === item ? (
                               <div className="flex items-center gap-1">
                                  <input 
                                    className="w-32 p-1 text-sm border-b-2 border-blue-500 outline-none bg-blue-50"
                                    value={editingItem.current}
                                    onChange={e => setEditingItem({...editingItem, current: e.target.value})}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && initiateSaveEdit()}
                                  />
                                  <button onClick={initiateSaveEdit} className="text-green-600 bg-green-50 p-1 rounded hover:bg-green-100"><Check className="w-4 h-4"/></button>
                                  <button onClick={() => setEditingItem(null)} className="text-slate-400 p-1 rounded hover:bg-slate-100"><X className="w-4 h-4"/></button>
                               </div>
                            ) : (
                               <>
                                 {item}
                                 <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition">
                                    <button 
                                       onClick={() => initiateEditItem(item)} 
                                       className="text-slate-300 hover:text-blue-500 transition p-1 hover:bg-blue-50 rounded"
                                    >
                                       <Edit className="w-3 h-3" />
                                    </button>
                                    <button 
                                       onClick={() => initiateDeleteItem(item)} 
                                       className="text-slate-300 hover:text-red-500 transition p-1 hover:bg-red-50 rounded"
                                    >
                                       <Trash2 className="w-3 h-3" />
                                    </button>
                                 </div>
                               </>
                            )}
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'users' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* User List */}
                <div className="space-y-4">
                   <h3 className="font-bold text-slate-800 mb-4">অ্যাকাউন্ট তালিকা</h3>
                   {users.map(u => (
                      <div key={u.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm transition hover:shadow-md">
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                 <UserIcon className="w-5 h-5" />
                              </div>
                              <div>
                                 <p className="font-bold text-slate-800">{u.name}</p>
                                 <div className="flex gap-2 text-xs">
                                    <span className="capitalize bg-slate-100 px-2 rounded text-slate-500">{u.role}</span>
                                    <span className="text-slate-400">{u.email}</span>
                                 </div>
                              </div>
                           </div>
                           <button onClick={() => handleDeleteUserClick(u)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                              <Trash2 className="w-5 h-5" />
                           </button>
                         </div>
                         
                         {/* Session Info */}
                         <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2">
                            <p className="font-bold text-slate-500 uppercase flex justify-between">
                               অ্যাক্টিভ ডিভাইস ({u.sessions?.length || 0})
                               <button 
                                 onClick={() => setSelectedUserForDevices(selectedUserForDevices?.id === u.id ? null : u)}
                                 className="text-blue-600 hover:underline"
                               >
                                  {selectedUserForDevices?.id === u.id ? 'লুকান' : 'ম্যানেজ করুন'}
                               </button>
                            </p>
                            
                            {selectedUserForDevices?.id === u.id && (
                               <div className="space-y-2 mt-2">
                                  {u.sessions?.map(sess => (
                                     <div key={sess.sessionId} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                                        <div>
                                           <div className="flex items-center gap-1 font-bold text-slate-700">
                                              {sess.deviceName.includes('Mobile') ? <Smartphone className="w-3 h-3"/> : <Laptop className="w-3 h-3"/>}
                                              {sess.deviceName}
                                           </div>
                                           <p className="text-[10px] text-slate-400">Login: {new Date(sess.loginTime).toLocaleString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                           <button onClick={() => handleTrustDevice(u.id, sess.sessionId)} title="Trust Device" className={sess.isTrusted ? "text-emerald-500" : "text-slate-300"}>
                                              <Shield className="w-4 h-4" />
                                           </button>
                                           <button onClick={() => handleRevokeSession(u.id, sess.sessionId)} title="Logout Device" className="text-red-400 hover:text-red-600">
                                              <Lock className="w-4 h-4" />
                                           </button>
                                        </div>
                                     </div>
                                  ))}
                                  {(!u.sessions || u.sessions.length === 0) && <p className="text-slate-400 italic">লগইন করা নেই</p>}
                               </div>
                            )}
                         </div>
                      </div>
                   ))}
                </div>

                {/* Add User */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-fit">
                   <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <Plus className="w-5 h-5" /> নতুন অ্যাকাউন্ট তৈরি
                   </h3>
                   <div className="space-y-4">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">নাম</label>
                         <input className="w-full p-3 rounded-xl border border-slate-300 bg-white" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="নাম লিখুন" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ইমেইল (লগইন আইডি)</label>
                         <input className="w-full p-3 rounded-xl border border-slate-300 bg-white" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@example.com" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পাসওয়ার্ড</label>
                         <div className="relative">
                            <Key className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                            <input className="w-full pl-10 p-3 rounded-xl border border-slate-300 bg-white" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="গোপন পাসওয়ার্ড" />
                         </div>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রোল (পাওয়ার)</label>
                         <div className="flex gap-2">
                            <button onClick={() => setNewUser({...newUser, role: 'manager'})} className={`flex-1 py-3 rounded-xl font-bold border transition ${newUser.role === 'manager' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>ম্যানেজার</button>
                            <button onClick={() => setNewUser({...newUser, role: 'admin'})} className={`flex-1 py-3 rounded-xl font-bold border transition ${newUser.role === 'admin' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600'}`}>অ্যাডমিন</button>
                         </div>
                      </div>
                      
                      <button onClick={addUser} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition mt-2">
                         অ্যাকাউন্ট সেভ করুন
                      </button>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'system' && (
             <div className="max-w-md">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Hash className="w-5 h-5" /> মেমো সিরিয়াল সেটআপ
                   </h3>
                   <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                         পরবর্তী মেমো নাম্বার কত থেকে শুরু হবে তা এখানে সেট করুন।
                      </p>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পরবর্তী মেমো নং</label>
                         <input 
                           type="number" 
                           className="w-full p-4 rounded-xl border border-slate-300 bg-white text-2xl font-bold text-center font-mono"
                           value={settings.nextInvoiceId}
                           onChange={e => setSettings({...settings, nextInvoiceId: Number(e.target.value)})}
                        />
                      </div>
                      <button onClick={() => notify('সেটিংস সেভ হয়েছে', 'success')} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg">
                         সেভ করুন
                      </button>
                   </div>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};
