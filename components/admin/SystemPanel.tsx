import React from 'react';
import { StoreSettings } from '../../types';
import { Hash } from 'lucide-react';

interface SystemPanelProps {
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SystemPanel: React.FC<SystemPanelProps> = ({ settings, setSettings, notify }) => {
  return (
    <div className="max-w-md">
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
