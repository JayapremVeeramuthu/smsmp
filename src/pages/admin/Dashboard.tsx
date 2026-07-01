import React, { useState, useEffect } from 'react';
import { employeeService } from '../../services/employeeService';
import { attendanceService } from '../../services/attendanceService';
import { formatDateString, getDateRange } from '../../utils/dateHelpers';
import type { Employee, Attendance, DailyReport } from '../../types';
import { 
  Users, 
  CalendarCheck2, 
  UserPlus, 
  UserMinus, 
  DollarSign, 
  FileCheck2, 
  TrendingUp, 
  Clock, 
  Loader2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  // Real-time state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [monthReports, setMonthReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const handleResetData = async () => {
    const confirmed = window.confirm("WARNING: This will permanently delete all EOD reports, manual overrides, correction requests, and audit logs. This action CANNOT be undone.\\n\\nAll employee accounts, login credentials, and profiles will remain intact.\\n\\nAre you sure you want to proceed?");
    if (!confirmed) return;

    const secondConfirm = window.prompt("To confirm, type RESET below:");
    if (secondConfirm !== 'RESET') {
      toast.error("Confirmation failed. Reset canceled.");
      return;
    }

    setResetting(true);
    try {
      const collectionsToClear = [
        'employee_shift_reports',
        'admin_manual_shift_reports',
        'correction_requests',
        'report_audit_logs',
        'employee_attendance',
        'admin_manual_attendance'
      ];

      for (const colName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, colName));
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, colName, docSnap.id)));
        await Promise.all(deletePromises);
      }

      toast.success("All transactional data successfully cleared! The system is now ready for production.");
      window.location.reload();
    } catch (err: any) {
      console.error("Reset failed:", err);
      toast.error(err.message || "Failed to clear some collections.");
    } finally {
      setResetting(false);
    }
  };

  const todayStr = formatDateString(new Date());
  
  // Ranges
  const { start: weekStart, end: weekEnd } = getDateRange('this_week');
  const { start: monthStart } = getDateRange('this_month');

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    
    // 1. Subscribe to Employees
    const unsubEmployees = employeeService.subscribeToEmployees((data) => {
      setEmployees(data);
    });

    // 2. Subscribe to Today's Attendance (handles merged employee + admin manual logs)
    const unsubAttendance = attendanceService.subscribeToDateAttendance(todayStr, (data) => {
      setTodayAttendance(data);
    });

    // 3. Subscribe to Month's Reports (V1: Employee Portal)
    const qEmpReports = query(
      collection(db, 'employee_shift_reports'),
      where('date', '>=', monthStart)
    );
    let empRepList: DailyReport[] = [];
    let adminRepList: DailyReport[] = [];

    const notifyReports = () => {
      setMonthReports([...empRepList, ...adminRepList]);
      setLoading(false);
    };

    const unsubEmpReports = onSnapshot(qEmpReports, (snapshot) => {
      empRepList = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        empRepList.push({
          id: docSnap.id,
          employeeId: data.employeeId,
          date: data.date,
          shift: data.shift,
          shiftValue: data.shiftValue,
          advance: data.advance,
          dailyEarnings: data.dailyEarnings,
          netAmount: data.netAmount,
          submittedBy: 'employee',
          submittedAt: data.submittedAt,
          entryType: 'portal'
        });
      });
      notifyReports();
    }, (error) => {
      console.error("Employee reports sub error:", error);
      setLoading(false);
    });

    // 4. Subscribe to Month's Reports (V2: Admin Manual)
    const qAdminReports = query(
      collection(db, 'admin_manual_shift_reports'),
      where('date', '>=', monthStart)
    );
    const unsubAdminReports = onSnapshot(qAdminReports, (snapshot) => {
      adminRepList = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        adminRepList.push({
          id: docSnap.id,
          employeeId: data.employeeId,
          date: data.date,
          shift: data.shift,
          shiftValue: data.shiftCount,
          advance: data.advance,
          dailyEarnings: data.dailyEarnings,
          netAmount: data.netAmount,
          submittedBy: 'admin',
          submittedAt: data.updatedAt,
          entryType: 'manual'
        });
      });
      notifyReports();
    }, (error) => {
      console.error("Admin manual reports sub error:", error);
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubEmpReports();
      unsubAdminReports();
    };
  }, [todayStr, monthStart]);

  // Derived Calculations (Real-time updates)
  const totalEmployeesCount = employees.length;
  
  const presentEmployeesCount = todayAttendance.filter(a => a.status === 'Present').length;
  const absentEmployeesCount = Math.max(0, totalEmployeesCount - presentEmployeesCount);
  
  const attendancePercentage = totalEmployeesCount > 0 
    ? Math.round((presentEmployeesCount / totalEmployeesCount) * 100) 
    : 0;

  // Filter report lists from our single monthly snapshot
  const todayReports = monthReports.filter(r => r.date === todayStr);
  const todaySubmittedCount = todayReports.length;
  const todayAdvanceGiven = todayReports.reduce((sum, r) => sum + r.advance, 0);

  const weekReports = monthReports.filter(r => r.date >= weekStart && r.date <= weekEnd);
  const weeklyEarnings = weekReports.reduce((sum, r) => sum + r.netAmount, 0);
  const monthlyEarnings = monthReports.reduce((sum, r) => sum + r.netAmount, 0);

  // Recent Activity Feed
  const recentActivities = [
    ...todayAttendance.map(a => ({
      id: `att-${a.employeeId}-${a.timeIn}-${a.submittedBy || 'employee'}`,
      type: 'attendance',
      employeeId: a.employeeId,
      time: a.timeIn,
      message: `marked present (${a.submittedBy === 'admin' ? 'Manual override' : 'Portal'})`,
      timestamp: a.createdAt
    })),
    ...todayReports.map(r => ({
      id: `rep-${r.employeeId}-${r.shift}-${r.submittedBy || 'employee'}`,
      type: 'report',
      employeeId: r.employeeId,
      time: r.submittedAt instanceof Date ? r.submittedAt.toLocaleTimeString() : (r.submittedAt as any).toDate().toLocaleTimeString(),
      message: `logged EOD report (${r.shift} shift, advance ₹${r.advance}) via ${r.submittedBy === 'admin' ? 'Manual override' : 'Portal'}`,
      timestamp: r.submittedAt
    }))
  ].sort((a, b) => {
    const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : (a.timestamp as any).toDate().getTime();
    const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : (b.timestamp as any).toDate().getTime();
    return tB - tA; // descending
  }).slice(0, 10); // Limit to 10 latest

  const getEmployeeName = (empId: string) => {
    return employees.find(e => e.employeeId === empId)?.name || empId;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-sm font-semibold text-slate-500 font-semibold">Loading real-time stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
        <p className="text-sm text-slate-400 font-medium">Real-time stats compiled across portal submissions and manual overrides.</p>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Total Employees */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Employees</p>
            <p className="text-2xl font-extrabold text-slate-800">{totalEmployeesCount}</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-2xl">
            <Users size={24} />
          </div>
        </div>

        {/* Present Employees */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Present Today</p>
            <p className="text-2xl font-extrabold text-emerald-600">{presentEmployeesCount}</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-2xl">
            <UserPlus size={24} />
          </div>
        </div>

        {/* Absent Employees */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Absent Today</p>
            <p className="text-2xl font-extrabold text-rose-600">{absentEmployeesCount}</p>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl">
            <UserMinus size={24} />
          </div>
        </div>

        {/* Attendance Percentage */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Attendance Rate</p>
            <p className="text-2xl font-extrabold text-slate-800">{attendancePercentage}%</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-2xl">
            <CalendarCheck2 size={24} />
          </div>
        </div>

        {/* Today's Submitted Reports */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Reports Logged</p>
            <p className="text-2xl font-extrabold text-slate-800">{todaySubmittedCount}</p>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3.5 rounded-2xl">
            <FileCheck2 size={24} />
          </div>
        </div>

        {/* Today's Advance Given */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Advance Today</p>
            <p className="text-2xl font-extrabold text-amber-600">₹{todayAdvanceGiven}</p>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3.5 rounded-2xl">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Weekly Net Salary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Weekly Salary Cost</p>
            <p className="text-2xl font-extrabold text-slate-800">₹{weeklyEarnings}</p>
          </div>
          <div className="bg-teal-50 text-teal-600 p-3.5 rounded-2xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Monthly Net Salary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Monthly Salary Cost</p>
            <p className="text-2xl font-extrabold text-blue-600">₹{monthlyEarnings}</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-2xl">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Main Content Grid (Recent Activity & Details Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2 text-left">
            <Clock size={18} className="text-slate-505" />
            <span>Live Audit Activity Feed</span>
          </h3>

          {recentActivities.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-100 rounded-xl">
              <p className="text-sm font-semibold text-slate-400">No activities recorded today yet.</p>
            </div>
          ) : (
            <div className="flow-root text-left">
              <ul className="-mb-8">
                {recentActivities.map((activity, idx) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {idx !== recentActivities.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3.5">
                        <div>
                          <span className={`
                            h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white
                            ${activity.type === 'attendance' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}
                          `}>
                            {activity.type === 'attendance' ? <UserPlus size={14} /> : <FileCheck2 size={14} />}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {getEmployeeName(activity.employeeId)}{' '}
                              <span className="font-normal text-slate-500">{activity.message}</span>
                            </p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-slate-400 font-mono">
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Quick Quick Details Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between text-left">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Shift Multipliers</h3>
            <p className="text-xs text-slate-400 mb-6 font-medium">Standard mappings used across the system for calculation.</p>
            
            <div className="space-y-3">
              {[
                { name: 'S', value: '1.0 Shift' },
                { name: 'SI', value: '1.5 Shifts' },
                { name: 'SII', value: '2.0 Shifts' },
                { name: 'SIII', value: '2.5 Shifts' },
                { name: 'SIIII', value: '3.0 Shifts' },
              ].map(shiftMap => (
                <div key={shiftMap.name} className="flex justify-between items-center text-sm font-semibold text-slate-650 border-b border-slate-50 pb-2">
                  <span>{shiftMap.name}</span>
                  <span className="text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-xs font-mono">{shiftMap.value}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-6 text-xs text-slate-500 font-medium">
            <p className="font-bold text-slate-600 mb-1">Formula Used:</p>
            <p>Earnings = Shift Value × Shift Rate</p>
            <p>Net Payout = Earnings - Cash Advance</p>
          </div>
        </div>
      </div>

      {/* Production Reset Console */}
      <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-xs text-left mt-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-rose-800 flex items-center space-x-2">
            <span className="bg-rose-55 text-rose-600 p-2 rounded-xl">
              <AlertCircle size={20} />
            </span>
            <span>Production Reset Console</span>
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Prepare the system for live production. This utility clears all transactional data (shift reports, manual logs, correction requests, and audit logs) while preserving employee master records, settings, and login credentials.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-slate-50 pt-4 gap-4">
          <span className="text-xs text-slate-505 font-bold">This operation is permanent and cannot be undone.</span>
          <button
            onClick={handleResetData}
            disabled={resetting}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {resetting ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>Clearing Database...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Reset Database for Production</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default AdminDashboard;
