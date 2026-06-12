
import React from 'react';
import { ActivityLog } from '../types';
import { History, User, Clock, Calendar } from 'lucide-react';

interface ActivityLogsProps {
  logs: ActivityLog[];
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ logs }) => {
  // Only show the last 50 logs to prevent rendering lag
  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

  // Group by date
  const groupedLogs: Record<string, ActivityLog[]> = {};
  sortedLogs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groupedLogs[date]) groupedLogs[date] = [];
    groupedLogs[date].push(log);
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8 font-bangla animate-fade-in">
       {Object.entries(groupedLogs).map(([date, dayLogs]) => (
          <div key={date} className="relative">
             <div className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 py-2 mb-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-600 flex items-center gap-2">
                   <Calendar className="w-4 h-4" /> {date}
                </h3>
             </div>
             <div className="space-y-4">
                {dayLogs.map(log => (
                   <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                         <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800 text-sm">{log.userName}</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded">
                               <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleTimeString('bn-BD')}
                            </span>
                         </div>
                         <p className="text-slate-600 text-sm font-medium mt-1">{log.action}</p>
                         <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       ))}
       {sortedLogs.length === 0 && (
          <div className="text-center py-20 text-slate-400">
             <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
             <p>কোনো অ্যাক্টিভিটি নেই</p>
          </div>
       )}
       {logs.length > 50 && (
          <div className="text-center text-xs text-slate-400 mt-8">
             পুরনো লগ স্বয়ংক্রিয়ভাবে হাইড করা হয়েছে (পারফরম্যান্সের জন্য)
          </div>
       )}
    </div>
  );
};
