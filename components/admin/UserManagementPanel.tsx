import React, { useState } from 'react';
import { User } from '../../types';
import { Plus, Trash2, User as UserIcon, Shield, Key, AlertTriangle, Laptop, Smartphone, Lock, Loader2 } from 'lucide-react';
import { createAuthUser, loadUsers, deleteUser } from '../../lib/db';

interface UserManagementPanelProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ users, setUsers, notify }) => {
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager' as 'admin' | 'manager' });
  const [selectedUserForDevices, setSelectedUserForDevices] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, userId: '', userName: '' });

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      notify('নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক', 'error'); return;
    }
    setIsCreating(true);
    const { error } = await createAuthUser(newUser.email, newUser.password, newUser.name, newUser.role);
    if (error) {
      notify('ত্রুটি: ' + error, 'error');
      setIsCreating(false);
      return;
    }
    // Reload users from DB to get the new user with correct ID
    const updatedUsers = await loadUsers();
    setUsers(updatedUsers);
    setNewUser({ name: '', email: '', password: '', role: 'manager' });
    notify('নতুন ইউজার তৈরি হয়েছে', 'success');
    setIsCreating(false);
  };

  const handleRevokeSession = (userId: string, sessionId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, sessions: u.sessions.filter(s => s.sessionId !== sessionId) } : u));
    notify('সেশন লগআউট করা হয়েছে', 'success');
  };

  const handleTrustDevice = (userId: string, sessionId: string) => {
    setUsers(prev => prev.map(u => u.id === userId
      ? { ...u, sessions: u.sessions.map(s => s.sessionId === sessionId ? { ...s, isTrusted: !s.isTrusted } : s) }
      : u
    ));
    notify('ডিভাইস স্ট্যাটাস আপডেট হয়েছে', 'success');
  };

  const executeDelete = async () => {
    if (!confirmDelete.userId || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUser(confirmDelete.userId);
      setUsers(prev => prev.map(u => u.id === confirmDelete.userId ? { ...u, role: 'disabled' } : u));
      notify(`ইউজার ${confirmDelete.userName} নিষ্ক্রিয় করা হয়েছে`, 'success');
      setConfirmDelete({ isOpen: false, userId: '', userName: '' });
    } catch (err) {
      notify('ইউজার ডিলিট ব্যর্থ হয়েছে', 'error');
      console.error('Delete user error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-fade-in border-2 border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">সতর্কতা! ডিলিট নিশ্চিত করুন</h3>
            <p className="text-slate-600 mb-6">
              আপনি ইউজার <span className="font-bold text-red-600">"{confirmDelete.userName}"</span> রিমুভ করতে চাচ্ছেন?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete({ isOpen: false, userId: '', userName: '' })} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">বাতিল</button>
              <button onClick={executeDelete} disabled={isDeleting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-60">{isDeleting ? "ডিলিট হচ্ছে..." : "ডিলিট করুন"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* User List */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 mb-4">অ্যাকাউন্ট তালিকা</h3>
          {users.map(u => (
            <div key={u.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : u.role === 'disabled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
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
                <button onClick={() => setConfirmDelete({ isOpen: true, userId: u.id, userName: u.name })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" disabled={u.role === 'disabled'}>
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-2">
                <p className="font-bold text-slate-500 uppercase flex justify-between">
                  অ্যাক্টিভ ডিভাইস ({u.sessions?.length || 0})
                  <button onClick={() => setSelectedUserForDevices(selectedUserForDevices?.id === u.id ? null : u)} className="text-blue-600 hover:underline">
                    {selectedUserForDevices?.id === u.id ? 'লুকান' : 'ম্যানেজ করুন'}
                  </button>
                </p>
                {selectedUserForDevices?.id === u.id && (
                  <div className="space-y-2 mt-2">
                    {u.sessions?.map(sess => (
                      <div key={sess.sessionId} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <div>
                          <div className="flex items-center gap-1 font-bold text-slate-700">
                            {sess.deviceName.includes('Mobile') ? <Smartphone className="w-3 h-3" /> : <Laptop className="w-3 h-3" />}
                            {sess.deviceName}
                          </div>
                          <p className="text-[10px] text-slate-400">Login: {new Date(sess.loginTime).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleTrustDevice(u.id, sess.sessionId)} className={sess.isTrusted ? 'text-emerald-500' : 'text-slate-300'} title="Trust Device">
                            <Shield className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRevokeSession(u.id, sess.sessionId)} className="text-red-400 hover:text-red-600" title="Logout Device">
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

        {/* Add User Form */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Plus className="w-5 h-5" /> নতুন অ্যাকাউন্ট তৈরি</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">নাম</label>
              <input className="w-full p-3 rounded-xl border border-slate-300 bg-white" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="নাম লিখুন" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ইমেইল (লগইন আইডি)</label>
              <input className="w-full p-3 rounded-xl border border-slate-300 bg-white" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পাসওয়ার্ড</label>
              <div className="relative">
                <Key className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                <input className="w-full pl-10 p-3 rounded-xl border border-slate-300 bg-white" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="গোপন পাসওয়ার্ড" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">রোল (পাওয়ার)</label>
              <div className="flex gap-2">
                <button onClick={() => setNewUser({ ...newUser, role: 'manager' })} className={`flex-1 py-3 rounded-xl font-bold border transition ${newUser.role === 'manager' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}>ম্যানেজার</button>
                <button onClick={() => setNewUser({ ...newUser, role: 'admin' })} className={`flex-1 py-3 rounded-xl font-bold border transition ${newUser.role === 'admin' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600'}`}>অ্যাডমিন</button>
              </div>
            </div>
            <button onClick={addUser} disabled={isCreating} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition mt-2 flex items-center justify-center gap-2 disabled:opacity-60">
              {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> তৈরি হচ্ছে...</> : 'অ্যাকাউন্ট সেভ করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
