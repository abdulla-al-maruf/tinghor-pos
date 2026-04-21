import React from 'react';
import { StoreSettings } from '../../types';
import { Building2, Hash, Phone, MapPin } from 'lucide-react';

interface SystemPanelProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SystemPanel: React.FC<SystemPanelProps> = ({ settings, setSettings, notify }) => {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" /> দোকানের তথ্য
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">দোকানের নাম</label>
            <input
              type="text"
              className="w-full p-3 rounded-xl border border-slate-300 bg-white"
              value={settings.shopName}
              onChange={e => setSettings(prev => ({ ...prev, shopName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">মোবাইল</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                className="w-full p-3 pl-9 rounded-xl border border-slate-300 bg-white"
                value={settings.shopPhone}
                onChange={e => setSettings(prev => ({ ...prev, shopPhone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ঠিকানা</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                className="w-full p-3 pl-9 rounded-xl border border-slate-300 bg-white"
                value={settings.shopAddress}
                onChange={e => setSettings(prev => ({ ...prev, shopAddress: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Hash className="w-5 h-5" /> মেমো সিরিয়াল সেটআপ
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">পরবর্তী মেমো নাম্বার কত থেকে শুরু হবে তা এখানে সেট করুন।</p>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">পরবর্তী মেমো নং</label>
            <input
              type="number"
              className="w-full p-4 rounded-xl border border-slate-300 bg-white text-2xl font-bold text-center font-mono"
              value={settings.nextInvoiceId}
              onChange={e => setSettings(prev => ({ ...prev, nextInvoiceId: Number(e.target.value) }))}
            />
          </div>
          <button onClick={() => notify('সেটিংস সেভ হয়েছে', 'success')} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg">
            সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
