import React, { useState, useContext } from 'react';
import { StoreSettings, User } from '../types';
import { Settings, Shield, Hash } from 'lucide-react';
import { ToastContext } from '../lib/contexts';
import { CategoryPanel } from './admin/CategoryPanel';
import { UserManagementPanel } from './admin/UserManagementPanel';
import { SystemPanel } from './admin/SystemPanel';

interface AdminSettingsProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, setSettings, users, setUsers }) => {
  const { notify } = useContext(ToastContext);
  const [activeTab, setActiveTab] = useState<'store' | 'users' | 'system'>('store');

  return (
    <div className="font-bangla space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex gap-4 border-b border-slate-100 pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'store' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings className="w-5 h-5" /> পণ্য সেটিংস
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Shield className="w-5 h-5" /> ইউজার ম্যানেজমেন্ট
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${activeTab === 'system' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Hash className="w-5 h-5" /> মেমো সেটিংস
          </button>
        </div>

        {activeTab === 'store' && <CategoryPanel settings={settings} setSettings={setSettings} notify={notify} />}
        {activeTab === 'users' && <UserManagementPanel users={users} setUsers={setUsers} notify={notify} />}
        {activeTab === 'system' && <SystemPanel settings={settings} setSettings={setSettings} notify={notify} />}
      </div>
    </div>
  );
};
