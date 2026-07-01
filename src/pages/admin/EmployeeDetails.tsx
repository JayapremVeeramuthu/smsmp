import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { employeeService } from '../../services/employeeService';
import { attendanceService } from '../../services/attendanceService';
import { reportService } from '../../services/reportService';
import type { Employee, Attendance, DailyReport, AdminManualAttendance, AdminManualShiftReport } from '../../types';
import { getDateRange, formatReadableDate } from '../../utils/dateHelpers';
import { 
  ArrowLeft, 
  DollarSign, 
  CalendarDays, 
  Coins, 
  Award,
  Loader2,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export const EmployeeDetails: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  // Core records state
  const [employee, setEmployee] = useState<Employee | null>(null);
  
  // Portal submissions
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  
  // Admin manual overrides
  const [adminAttendance, setAdminAttendance] = useState<AdminManualAttendance[]>([]);
  const [adminReports, setAdminReports] = useState<AdminManualShiftReport[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Filters for summaries and statements
  const [period, setPeriod] = useState<'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all'>('this_week');
  const [sourceFilter, setSourceFilter] = useState<'combined' | 'employee' | 'admin'>('combined');

  // Load employee and subscribe to all logs
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    let unsubAttendance: (() => void) | null = null;
    let unsubReports: (() => void) | null = null;
    let unsubAdminAtt: (() => void) | null = null;
    let unsubAdminRep: (() => void) | null = null;

    const loadData = async () => {
      try {
        const empRecord = await employeeService.getEmployeeByUid(uid);
        if (!empRecord || empRecord.status === 'deleted') {
          toast.error('Employee not found.');
          navigate('/admin/employees');
          return;
        }
        setEmployee(empRecord);

        // 1. Subscribe to Portal Attendance
        unsubAttendance = attendanceService.subscribeToEmployeeAttendance(empRecord.employeeId, (data) => {
          setAttendance(data);
        });

        // 2. Subscribe to Portal Shift Reports
        unsubReports = reportService.subscribeToEmployeeReports(empRecord.employeeId, (data) => {
          setReports(data);
        });

        // 3. Subscribe to Admin Manual Attendance
        unsubAdminAtt = attendanceService.subscribeToAdminManualAttendance(empRecord.employeeId, (data) => {
          setAdminAttendance(data);
        });

        // 4. Subscribe to Admin Manual Shift Reports
        unsubAdminRep = reportService.subscribeToAdminManualReports(empRecord.employeeId, (data) => {
          setAdminReports(data);
          setLoading(false);
        });
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load employee records');
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubAttendance) unsubAttendance();
      if (unsubReports) unsubReports();
      if (unsubAdminAtt) unsubAdminAtt();
      if (unsubAdminRep) unsubAdminRep();
    };
  }, [uid, navigate]);

  // Derived date bounds
  const dateBounds = useMemo(() => {
    if (period === 'all') return { start: '1970-01-01', end: '9999-12-31' };
    return getDateRange(period);
  }, [period]);

  // Unified Merged Logs by Date & Source for auditing
  const unifiedLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      date: string;
      attendance: Attendance | null;
      report: DailyReport | null;
      source: 'employee' | 'admin';
    }> = [];

    const allDates = new Set<string>([
      ...attendance.map(a => a.date),
      ...adminAttendance.map(a => a.date),
      ...reports.map(r => r.date),
      ...adminReports.map(r => r.date)
    ]);

    const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

    sortedDates.forEach(dateStr => {
      // Portal record
      const empAtt = attendance.find(a => a.date === dateStr);
      const empRep = reports.find(r => r.date === dateStr);
      if (empAtt || empRep) {
        logs.push({
          id: `portal-${dateStr}`,
          date: dateStr,
          attendance: empAtt || null,
          report: empRep || null,
          source: 'employee'
        });
      }

      // Manual override record
      const admAtt = adminAttendance.find(a => a.date === dateStr);
      const admRep = adminReports.find(r => r.date === dateStr);
      if (admAtt || admRep) {
        logs.push({
          id: `manual-${dateStr}`,
          date: dateStr,
          attendance: admAtt ? {
            employeeId: admAtt.employeeId,
            date: admAtt.date,
            timeIn: admAtt.timeIn,
            status: admAtt.attendanceStatus,
            createdAt: admAtt.createdAt,
            submittedBy: 'admin',
            entryType: 'manual'
          } : null,
          report: admRep ? {
            employeeId: admRep.employeeId,
            date: admRep.date,
            shift: admRep.shift,
            shiftValue: admRep.shiftCount,
            advance: admRep.advance,
            dailyEarnings: admRep.dailyEarnings,
            netAmount: admRep.netAmount,
            submittedBy: 'admin',
            submittedAt: admRep.updatedAt,
            entryType: 'manual'
          } : null,
          source: 'admin'
        });
      }
    });

    return logs;
  }, [attendance, adminAttendance, reports, adminReports]);

  // Filters unified logs for display based on date bounds and source
  const displayedLogs = useMemo(() => {
    return unifiedLogs.filter(log => {
      const matchesDate = log.date >= dateBounds.start && log.date <= dateBounds.end;
      const matchesSource = sourceFilter === 'combined' || log.source === sourceFilter;
      return matchesDate && matchesSource;
    });
  }, [unifiedLogs, dateBounds, sourceFilter]);

  // Summary Card Computations based on active display parameters
  const summaryAggregates = useMemo(() => {
    let workingDays = 0;
    let totalShifts = 0;
    let totalAdvance = 0;
    let grossEarnings = 0;

    displayedLogs.forEach(log => {
      if (log.attendance && log.attendance.status === 'Present') {
        workingDays++;
      }
      if (log.report) {
        totalShifts += log.report.shiftValue;
        totalAdvance += log.report.advance;
        grossEarnings += log.report.dailyEarnings;
      }
    });

    const netSalary = grossEarnings - totalAdvance;

    return { workingDays, totalShifts, grossEarnings, totalAdvance, netSalary };
  }, [displayedLogs]);

  if (loading || !employee) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-sm font-semibold text-slate-500 font-semibold">Loading employee details dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navigation & Header */}
      <div className="flex items-center space-x-4">
        <Link 
          to="/admin/employees" 
          className="p-2 bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl shadow-xs transition"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-slate-800">{employee.name}</h2>
          <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">{employee.employeeId}</p>
        </div>
      </div>

      {/* Grid Layout (Left Profile Panel & Right Logs List) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Personal Profile & Period Calculations */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider text-left">Profile Information</h3>
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl font-bold text-lg">
                {employee.name.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-slate-800">{employee.name}</p>
                <span className={`px-2 py-0.5 inline-flex text-xxs font-bold rounded-full border ${
                  employee.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {employee.status}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-50 pt-4 space-y-2.5 text-sm text-left font-semibold">
              <div className="flex justify-between items-center text-slate-550">
                <span>Phone:</span>
                <span className="text-slate-800">{employee.phone || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-550">
                <span>Shift Rate:</span>
                <span className="text-slate-800 font-bold">₹{employee.shiftRate} / Shift</span>
              </div>
              <div className="flex justify-between items-center text-slate-555">
                <span>Registered:</span>
                <span className="text-slate-800 text-xs">
                  {employee.createdAt ? new Date((employee.createdAt as any).seconds * 1000).toLocaleDateString() : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Period Calculations Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-550 uppercase tracking-wider">Salary Calculator</h3>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="py-1.5 pl-2 pr-6 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="this_week">This Week</option>
                  <option value="last_week">Last Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Source Filters dropdown */}
              <div className="flex items-center justify-between text-left">
                <span className="text-xs font-bold text-slate-505 uppercase">Audit Scope</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className="py-1.5 pl-2 pr-6 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-655 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="combined">Combined View</option>
                  <option value="employee">Portal Only</option>
                  <option value="admin">Manual Entry Only</option>
                </select>
              </div>
            </div>

            {/* Calculations Blocks */}
            <div className="space-y-4">
              {/* Working Days */}
              <div className="flex items-center justify-between p-3 bg-slate-55/30 border border-slate-50 rounded-xl text-left">
                <div className="flex items-center space-x-2.5 text-slate-500">
                  <CalendarDays size={18} />
                  <span className="text-xs font-semibold">Working Days</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{summaryAggregates.workingDays} Days</span>
              </div>

              {/* Total Shifts */}
              <div className="flex items-center justify-between p-3 bg-slate-55/30 border border-slate-50 rounded-xl text-left">
                <div className="flex items-center space-x-2.5 text-slate-500">
                  <Award size={18} />
                  <span className="text-xs font-semibold">Total Shifts</span>
                </div>
                <span className="text-sm font-bold text-slate-800 font-mono">{summaryAggregates.totalShifts} Shifts</span>
              </div>

              {/* Gross Earnings */}
              <div className="flex items-center justify-between p-3 bg-slate-55/30 border border-slate-50 rounded-xl text-left">
                <div className="flex items-center space-x-2.5 text-slate-500">
                  <DollarSign size={18} />
                  <span className="text-xs font-semibold">Gross Salary</span>
                </div>
                <span className="text-sm font-bold text-slate-800">₹{summaryAggregates.grossEarnings}</span>
              </div>

              {/* Advance Taken */}
              <div className="flex items-center justify-between p-3 bg-rose-50/30 border border-rose-50/50 rounded-xl text-left">
                <div className="flex items-center space-x-2.5 text-rose-600/85">
                  <Coins size={18} />
                  <span className="text-xs font-semibold">Advance Deducted</span>
                </div>
                <span className="text-sm font-bold text-rose-600">-₹{summaryAggregates.totalAdvance}</span>
              </div>

              {/* Net Payout */}
              <div className="flex items-center justify-between p-3.5 bg-blue-600 text-white rounded-xl shadow-xs text-left">
                <div className="flex items-center space-x-2.5">
                  <DollarSign size={18} />
                  <span className="text-xs font-bold">Net Salary Payable</span>
                </div>
                <span className="text-base font-extrabold">₹{summaryAggregates.netSalary}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Merged Logs Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-550 uppercase tracking-wider">Detailed Statement</h3>
              <span className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full text-slate-500 font-semibold">
                Showing {displayedLogs.length} logs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-55/30">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Origin</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Attendance</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Shift Log</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Earnings</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Advance</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50 font-medium">
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                        No activity recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/20 text-left">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                          {formatReadableDate(log.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xxs font-extrabold rounded-full border items-center space-x-1 ${
                            log.source === 'employee' 
                              ? 'bg-blue-50 text-blue-700 border-blue-100' 
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {log.source === 'employee' ? <UserCheck size={10} className="mr-0.5" /> : <ShieldCheck size={10} className="mr-0.5" />}
                            <span>
                              {log.source === 'employee' ? 'Employee Portal' : 'Admin Manual'}
                            </span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold">
                          {log.attendance ? (
                            <span className="inline-flex items-center space-x-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${log.attendance.status === 'Present' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              <span className={`${log.attendance.status === 'Present' ? 'text-emerald-700' : 'text-rose-750'} text-xs font-bold`}>{log.attendance.status}</span>
                              <span className="text-slate-400 text-xxs font-mono">({log.attendance.timeIn})</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 text-xs font-bold">Absent / Not Logged</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-600">
                          {log.report ? `${log.report.shift} (${log.report.shiftValue})` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-bold">
                          {log.report ? `₹${log.report.dailyEarnings}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">
                          {log.report && log.report.advance > 0 ? `₹${log.report.advance}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-extrabold">
                          {log.report ? `₹${log.report.netAmount}` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default EmployeeDetails;
