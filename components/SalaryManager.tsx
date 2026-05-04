
import React, { useState, useContext } from 'react';
import { Employee, SalaryRecord, User, Attendance } from '../types';
import { User as UserIcon, Plus, Wallet, CheckCircle, Clock, Trash2, XCircle, CalendarCheck, Calendar as CalIcon, FileText, ChevronDown, ChevronUp, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { generateId } from '../lib/utils';
import { ToastContext } from '../lib/contexts';

interface SalaryManagerProps {
  employees: Employee[];
  salaryRecords: SalaryRecord[];
  onAddEmployee: (emp: Employee) => void;
  onAddRecord: (rec: SalaryRecord) => void;
  currentUser: User;
  onUpdateAttendance: (rec: Attendance) => void;
  attendance: Attendance[];
  onUpdateEmployee?: (emp: Employee) => void;
  onDeleteEmployee?: (id: string) => void;
}

export const SalaryManager: React.FC<SalaryManagerProps> = ({ employees, salaryRecords, onAddEmployee, onAddRecord, onDeleteEmployee, onUpdateAttendance, attendance }) => {
  const [activeTab, setActiveTab] = useState<'payment' | 'attendance'>('payment');
  const [attendanceView, setAttendanceView] = useState<'daily' | 'monthly'>('daily');
  const { notify } = useContext(ToastContext);
  
  // -- Common States --
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  
  // -- Payment States --
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDesig, setNewEmpDesig] = useState('');
  const [newEmpBase, setNewEmpBase] = useState('');
  const [isAddingEmp, setIsAddingEmp] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState<'salary' | 'advance'>('advance');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNote, setPayNote] = useState('');

  // -- Attendance States --
  const [attendDate, setAttendDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Report Filter State
  const [reportMonth, setReportMonth] = useState(new Date().getMonth().toString()); // 0-11
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());

  // Toggle Details in Monthly View
  const [expandedEmpReport, setExpandedEmpReport] = useState<string | null>(null);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  // --- Handlers ---

  const handleCreateEmployee = () => {
    if (!newEmpName || !newEmpBase) return;
    if (Number(newEmpBase) <= 0) { notify('বৈধ বেস বেতন দিন', 'error'); return; }
    onAddEmployee({
      id: generateId(),
      name: newEmpName,
      phone: newEmpPhone,
      designation: newEmpDesig || 'Staff',
      baseSalary: Number(newEmpBase),
      joinedDate: Date.now()
    });
    setNewEmpName('');
    setNewEmpPhone('');
    setNewEmpDesig('');
    setNewEmpBase('');
    setIsAddingEmp(false);
  };

  const handlePayment = () => {
    if (!selectedEmpId || !payAmount) return;
    if (Number(payAmount) <= 0) { notify('বৈধ পরিমাণ দিন', 'error'); return; }
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;

    const d = new Date(payDate);
    
    onAddRecord({
      id: generateId(),
      employeeId: emp.id,
      employeeName: emp.name,
      amount: Number(payAmount),
      type: payType,
      forMonth: months[d.getMonth()],
      forYear: d.getFullYear(),
      date: d.getTime(), // Use selected date
      note: payNote
    });
    setPayAmount('');
    setPayNote('');
    notify('পেমেন্ট সেভ হয়েছে', 'success');
  };

  const handleAttendanceMark = (empId: string, status: 'present' | 'absent' | 'late') => {
     onUpdateAttendance({
        id: `${empId}_${attendDate}`,
        employeeId: empId,
        date: attendDate,
        status: status,
        timestamp: Date.now()
     });
  };

  const getAttendanceStatus = (empId: string) => {
     const record = attendance.find(a => a.employeeId === empId && a.date === attendDate);
     return record ? record.status : null; 
  };

  // --- Derived Data ---
  const getEmployeeBalance = (empId: string) => {
    const empRecords = salaryRecords.filter(r => r.employeeId === empId);
    const totalAdvance = empRecords.filter(r => r.type === 'advance').reduce((s,r) => s + r.amount, 0);
    const totalSalaryPaid = empRecords.filter(r => r.type === 'salary').reduce((s,r) => s + r.amount, 0);
    const lastPayment = empRecords.sort((a,b) => b.date - a.date)[0];
    return { totalAdvance, totalSalaryPaid, lastPayment };
  };

  const getMonthlyStats = (empId: string) => {
    // Filter attendance records for selected Month & Year
    const targetPrefix = `${reportYear}-${(Number(reportMonth) + 1).toString().padStart(2, '0')}`;
    
    const monthlyRecords = attendance.filter(a => 
      a.employeeId === empId && a.date.startsWith(targetPrefix)
    );

    const absentDays = monthlyRecords.filter(a => a.status === 'absent');
    const lateDays = monthlyRecords.filter(a => a.status === 'late');

    return {
       absentCount: absentDays.length,
       lateCount: lateDays.length,
       monthlyRecords
    };
  };

  const renderCalendar = (empId: string) => {
    const year = Number(reportYear);
    const month = Number(reportMonth);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay(); // 0 for Sunday
    const days = [];

    // Empty cells for start padding
    for (let i = 0; i < startDay; i++) {
       days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days generation
    for (let d = 1; d <= daysInMonth; d++) {
       const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
       const record = attendance.find(a => a.employeeId === empId && a.date === dateStr);
       const status = record ? record.status : 'present'; // Default Present
       
       // Check if future date
       const isFuture = new Date(dateStr) > new Date();
       
       let bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-100'; // Present (Default)
       if (status === 'absent') bgClass = 'bg-red-100 text-red-700 border-red-200 font-bold';
       if (status === 'late') bgClass = 'bg-amber-100 text-amber-700 border-amber-200 font-bold';
       if (isFuture) bgClass = 'bg-slate-50 text-slate-300 border-slate-100';

       days.push(
          <div key={d} className={`aspect-square p-1 rounded-lg border flex flex-col items-center justify-center text-xs relative group transition-all ${bgClass}`}>
             <span className="text-[10px] md:text-sm">{d}</span>
             {!isFuture && (
                <div className="hidden md:block text-[8px] uppercase mt-1 tracking-tighter">
                   {status === 'present' ? 'P' : status === 'absent' ? 'A' : 'L'}
                </div>
             )}
             {/* Tooltip */}
             {!isFuture && (
               <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                 {status.toUpperCase()}
               </div>
             )}
          </div>
       );
    }

    return (
       <div className="mt-4 animate-scale-in">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold text-slate-400 uppercase">
             <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
             {days}
          </div>
       </div>
    );
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmpId);
  const selectedEmpHistory = salaryRecords
      .filter(r => r.employeeId === selectedEmpId)
      .sort((a,b) => b.date - a.date);

  return (
    <div className="font-bangla space-y-6 animate-fade-in h-[calc(100vh-140px)] flex flex-col">
       
       {/* Top Navigation Tabs */}
       <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('payment')}
               className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm ${activeTab === 'payment' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Wallet className="w-4 h-4"/> পেমেন্ট
             </button>
             <button 
               onClick={() => setActiveTab('attendance')}
               className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm ${activeTab === 'attendance' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <CalendarCheck className="w-4 h-4"/> হাজিরা খাতা
             </button>
          </div>

          {activeTab === 'attendance' && (
             <div className="flex gap-2">
                <button 
                  onClick={() => setAttendanceView('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${attendanceView === 'daily' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'}`}
                >
                   আজকের এন্ট্রি
                </button>
                <button 
                  onClick={() => setAttendanceView('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${attendanceView === 'monthly' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'}`}
                >
                   মাসিক রিপোর্ট
                </button>
             </div>
          )}
       </div>

       {/* --- ATTENDANCE VIEW --- */}
       {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
             
             {/* DAILY ENTRY VIEW */}
             {attendanceView === 'daily' && (
                <>
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                         <CalendarCheck className="w-6 h-6 text-blue-600"/> দৈনিক হাজিরা এন্ট্রি
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">তারিখ সিলেক্ট করে অনুপস্থিত মার্ক করুন</p>
                   </div>
                   
                   <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-500 px-2">তারিখ:</span>
                      <input 
                        type="date" 
                        className="p-2 rounded-lg border border-slate-300 font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={attendDate}
                        onChange={e => setAttendDate(e.target.value)}
                      />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {employees.map(emp => {
                         const status = getAttendanceStatus(emp.id);
                         const displayStatus = status || 'present'; 

                         return (
                            <div key={emp.id} className={`p-4 rounded-xl border transition flex justify-between items-center ${displayStatus === 'absent' ? 'bg-red-50 border-red-200' : displayStatus === 'late' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                               <div>
                                  <h4 className="font-bold text-slate-800">{emp.name}</h4>
                                  <p className="text-xs text-slate-500 mb-2">{emp.designation}</p>
                                  <div className="flex items-center gap-2">
                                     {displayStatus === 'present' && <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> উপস্থিত (Auto)</span>}
                                     {displayStatus === 'absent' && <span className="text-red-600 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> অনুপস্থিত</span>}
                                     {displayStatus === 'late' && <span className="text-amber-600 text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> লেট / হাফ-ডে</span>}
                                  </div>
                               </div>

                               <div className="flex gap-2">
                                  {displayStatus === 'present' ? (
                                     <>
                                        <button onClick={() => handleAttendanceMark(emp.id, 'late')} className="p-2 bg-white border border-amber-200 text-amber-500 rounded-lg hover:bg-amber-50 transition" title="Mark Late">
                                           <Clock className="w-5 h-5"/>
                                        </button>
                                        <button onClick={() => handleAttendanceMark(emp.id, 'absent')} className="p-2 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition" title="Mark Absent">
                                           <XCircle className="w-5 h-5"/>
                                        </button>
                                     </>
                                  ) : (
                                     <button onClick={() => handleAttendanceMark(emp.id, 'present')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition shadow">
                                        উপস্থিত মার্ক করুন
                                     </button>
                                  )}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                   {employees.length === 0 && (
                      <div className="text-center p-10 text-slate-400">কোনো কর্মচারী নেই</div>
                   )}
                </div>
                </>
             )}

             {/* MONTHLY REPORT VIEW (CALENDAR) */}
             {attendanceView === 'monthly' && (
                <div className="flex flex-col h-full">
                   <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <CalIcon className="w-5 h-5 text-purple-600"/> মাসিক হাজিরা ক্যালেন্ডার
                         </h3>
                         <div className="flex gap-2">
                            <select 
                               value={reportMonth} 
                               onChange={(e) => setReportMonth(e.target.value)}
                               className="p-2 rounded-lg border border-slate-300 font-bold text-slate-700 text-sm focus:outline-none"
                            >
                               {monthsBn.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select 
                               value={reportYear} 
                               onChange={(e) => setReportYear(e.target.value)}
                               className="p-2 rounded-lg border border-slate-300 font-bold text-slate-700 text-sm focus:outline-none"
                            >
                               {Array.from({length: 6}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                  <option key={y} value={String(y)}>{y}</option>
                               ))}
                            </select>
                         </div>
                      </div>
                      
                      <div className="flex gap-4 text-xs font-bold text-slate-500 bg-white p-3 rounded-xl border border-slate-200 w-fit">
                         <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> উপস্থিত</span>
                         <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> ছুটি (Absent)</span>
                         <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> লেট</span>
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                      <div className="space-y-4">
                         {employees.map(emp => {
                            const stats = getMonthlyStats(emp.id);
                            const isExpanded = expandedEmpReport === emp.id;
                            const isDanger = stats.absentCount > 2;

                            return (
                               <div key={emp.id} className={`bg-white border rounded-xl overflow-hidden transition ${isExpanded ? 'shadow-lg ring-1 ring-blue-200 border-blue-300' : 'border-slate-200 hover:shadow-md'}`}>
                                  <div 
                                    className="p-4 flex flex-col sm:flex-row justify-between items-center cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedEmpReport(isExpanded ? null : emp.id)}
                                  >
                                     <div className="flex items-center gap-4 mb-3 sm:mb-0 w-full sm:w-auto">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 text-lg">
                                           {emp.name[0]}
                                        </div>
                                        <div>
                                           <h4 className="font-bold text-slate-800 text-lg">{emp.name}</h4>
                                           <p className="text-xs text-slate-500">{emp.designation}</p>
                                        </div>
                                     </div>

                                     <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-center">
                                           <span className="block text-[10px] font-bold text-slate-400 uppercase">মোট ছুটি (Absent)</span>
                                           <span className={`text-xl font-bold ${isDanger ? 'text-red-600' : 'text-slate-700'}`}>
                                              {stats.absentCount}
                                           </span>
                                        </div>
                                        <div className="text-center">
                                           <span className="block text-[10px] font-bold text-slate-400 uppercase">মোট লেট</span>
                                           <span className="text-xl font-bold text-amber-600">
                                              {stats.lateCount}
                                           </span>
                                        </div>
                                        <div className="text-slate-400">
                                           {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                                        </div>
                                     </div>
                                  </div>

                                  {isExpanded && (
                                     <div className="bg-slate-50 p-6 border-t border-slate-100 animate-fade-in">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
                                           <CalendarCheck className="w-4 h-4 text-blue-600"/> উপস্থিতি ক্যালেন্ডার:
                                        </h5>
                                        {renderCalendar(emp.id)}
                                     </div>
                                  )}
                               </div>
                            );
                         })}
                      </div>
                   </div>
                </div>
             )}
          </div>
       )}

       {/* ... Payment View Code Remains Same ... */}
       {activeTab === 'payment' && (
          <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
             {/* Left: Employee List */}
             <div className="md:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-bold text-slate-800">কর্মচারী তালিকা</h3>
                   <button onClick={() => setIsAddingEmp(!isAddingEmp)} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                      <Plus className="w-5 h-5" />
                   </button>
                </div>

                {isAddingEmp && (
                   <div className="p-4 bg-blue-50 border-b border-blue-100 space-y-3 animate-fade-in">
                      <input className="w-full p-2 rounded border" placeholder="নাম" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} />
                      <input className="w-full p-2 rounded border" placeholder="পদবি (Staff/Labor)" value={newEmpDesig} onChange={e => setNewEmpDesig(e.target.value)} />
                      <input className="w-full p-2 rounded border" placeholder="বেতন (টাকা)" type="number" value={newEmpBase} onChange={e => setNewEmpBase(e.target.value)} />
                      <button onClick={handleCreateEmployee} className="w-full bg-blue-600 text-white py-2 rounded font-bold">সেভ করুন</button>
                   </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                   {employees.map(emp => {
                      const stats = getEmployeeBalance(emp.id);
                      return (
                         <div 
                           key={emp.id} 
                           onClick={() => setSelectedEmpId(emp.id)}
                           className={`p-3 rounded-xl border cursor-pointer transition relative ${selectedEmpId === emp.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                         >
                            <div className="flex justify-between items-start">
                               <div>
                                  <h4 className="font-bold text-slate-800">{emp.name}</h4>
                                  <p className="text-xs text-slate-500">{emp.designation} • ৳{emp.baseSalary}/মাস</p>
                               </div>
                               <div className="text-right flex flex-col items-end gap-1">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded flex items-center gap-1">
                                     <Wallet className="w-3 h-3"/> পে: ৳{stats.totalSalaryPaid}
                                  </span>
                               </div>
                            </div>
                         </div>
                      );
                   })}
                </div>
             </div>

             {/* Right: Details & Ledger */}
             <div className="md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                {selectedEmployee ? (
                   <>
                     {/* Header Profile */}
                     <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400">
                              <UserIcon className="w-6 h-6" />
                           </div>
                           <div>
                              <h2 className="text-xl font-bold text-slate-800">{selectedEmployee.name}</h2>
                              <p className="text-sm text-slate-500">{selectedEmployee.designation} | জয়েনিং: {new Date(selectedEmployee.joinedDate).toLocaleDateString('bn-BD')}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-bold text-slate-400 uppercase">মাসিক বেতন</p>
                           <p className="text-2xl font-bold text-blue-600">৳{selectedEmployee.baseSalary.toLocaleString()}</p>
                        </div>
                     </div>

                     {/* Action Area */}
                     <div className="p-6 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <h4 className="font-bold text-slate-700 flex items-center gap-2">
                              <Wallet className="w-5 h-5 text-emerald-600" /> নতুন পেমেন্ট এন্ট্রি
                           </h4>
                           <div className="grid grid-cols-2 gap-3">
                               <div className="col-span-2">
                                 <label className="text-xs font-bold text-slate-400 block mb-1">তারিখ</label>
                                 <input type="date" className="w-full p-2 border rounded-lg font-bold text-slate-600" value={payDate} onChange={e => setPayDate(e.target.value)} />
                               </div>
                               <div>
                                  <label className={`block p-3 border rounded-lg cursor-pointer text-center font-bold text-sm transition ${payType === 'advance' ? 'bg-red-50 border-red-500 text-red-600' : 'bg-white hover:bg-slate-50'}`}>
                                     <input type="radio" className="hidden" name="ptype" checked={payType === 'advance'} onChange={() => setPayType('advance')} />
                                     অগ্রিম
                                  </label>
                               </div>
                               <div>
                                  <label className={`block p-3 border rounded-lg cursor-pointer text-center font-bold text-sm transition ${payType === 'salary' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white hover:bg-slate-50'}`}>
                                     <input type="radio" className="hidden" name="ptype" checked={payType === 'salary'} onChange={() => setPayType('salary')} />
                                     বেতন
                                  </label>
                               </div>
                           </div>
                           <div className="flex gap-2">
                              <input className="flex-1 p-3 border rounded-lg font-bold text-lg" type="number" placeholder="পরিমাণ (৳)" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                              <button onClick={handlePayment} className="bg-slate-800 text-white px-6 rounded-lg font-bold hover:bg-slate-900">সেভ</button>
                           </div>
                           <input className="w-full p-2 border rounded-lg text-sm" placeholder="নোট (ঐচ্ছিক)" value={payNote} onChange={e => setPayNote(e.target.value)} />
                        </div>

                        {/* Summary Box */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                            <h4 className="font-bold text-slate-600 mb-3">মোট প্রদান (সর্বমোট)</h4>
                            <div className="space-y-2">
                               <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500">মোট বেতন দেওয়া হয়েছে</span>
                                  <span className="font-bold text-emerald-600">৳{selectedEmpHistory.filter(r=>r.type==='salary').reduce((s,r)=>s+r.amount,0).toLocaleString()}</span>
                               </div>
                               <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-500">মোট অগ্রিম দেওয়া হয়েছে</span>
                                  <span className="font-bold text-red-600">৳{selectedEmpHistory.filter(r=>r.type==='advance').reduce((s,r)=>s+r.amount,0).toLocaleString()}</span>
                               </div>
                               <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                                  <button 
                                     onClick={() => onDeleteEmployee && onDeleteEmployee(selectedEmployee.id)}
                                     className="text-red-500 text-xs font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                                  >
                                     <Trash2 className="w-3 h-3"/> কর্মচারী ডিলিট করুন
                                  </button>
                               </div>
                            </div>
                        </div>
                     </div>

                     {/* Ledger History */}
                     <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left border-collapse">
                           <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold sticky top-0">
                              <tr>
                                 <th className="p-4 border-b">তারিখ</th>
                                 <th className="p-4 border-b">বিবরণ (Type)</th>
                                 <th className="p-4 border-b">মন্তব্য</th>
                                 <th className="p-4 border-b text-right">টাকা</th>
                              </tr>
                           </thead>
                           <tbody className="text-sm">
                              {selectedEmpHistory.map(record => (
                                 <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="p-4 text-slate-600">
                                       {new Date(record.date).toLocaleDateString('bn-BD')}
                                    </td>
                                    <td className="p-4">
                                       <span className={`px-2 py-1 rounded text-xs font-bold ${record.type === 'salary' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                          {record.type === 'salary' ? 'বেতন' : 'অগ্রিম'}
                                       </span>
                                    </td>
                                    <td className="p-4 text-slate-500">{record.note || '-'}</td>
                                    <td className="p-4 text-right font-bold text-slate-800">৳{record.amount.toLocaleString()}</td>
                                 </tr>
                              ))}
                              {selectedEmpHistory.length === 0 && (
                                 <tr>
                                    <td colSpan={4} className="p-10 text-center text-slate-400">কোনো লেনদেন পাওয়া যায়নি</td>
                                 </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                   </>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                      <UserIcon className="w-16 h-16 mb-4 opacity-20" />
                      <p>বাম পাশ থেকে কর্মচারী সিলেক্ট করুন</p>
                   </div>
                )}
             </div>
          </div>
       )}
    </div>
  );
};
