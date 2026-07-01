import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService } from '../../services/reportService';
import { exportService } from '../../services/exportService';
import { formatDateString, getDateRange, formatReadableDate, formatTimeAmPm } from '../../utils/dateHelpers';
import type { DailyReport } from '../../types';
import { 
  FileSpreadsheet, 
  FileDown, 
  Calendar, 
  Search, 
  Loader2, 
  CalendarDays,
  Award,
  Coins,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const MyReports: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Filter State
  const [filterType, setFilterType] = useState<string>('this_week');
  const [customRange, setCustomRange] = useState({
    startDate: formatDateString(new Date()),
    endDate: formatDateString(new Date())
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Firebase Data State (Reports only, attendance subscription removed)
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    if (!profile?.employeeId) return;
    setLoading(true);
    setError(null);

    // Subscribe to employee daily reports
    const unsubReports = reportService.subscribeToEmployeeReports(
      profile.employeeId, 
      (data) => {
        setReports(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(t('failed_to_fetch_reports'));
        setLoading(false);
      }
    );

    return () => {
      unsubReports();
    };
  }, [profile?.employeeId, t]);

  // Derived Date Ranges
  const dateBounds = useMemo(() => {
    return getDateRange(filterType, customRange);
  }, [filterType, customRange]);

  // Timezone-safe local date parser
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Timezone-safe week-range format helper (Monday to Sunday)
  const getWeekRangeString = (dateStr: string): string => {
    const d = parseLocalDate(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${formatDateString(monday)} to ${formatDateString(sunday)}`;
  };

  // Timezone-safe month-name format helper
  const getMonthString = (dateStr: string): string => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Compile Unified Daily logs for the selected date range using reports only
  const dailyLogs = useMemo(() => {
    const allDates = new Set<string>();
    
    reports.forEach(r => {
      if (r.date >= dateBounds.start && r.date <= dateBounds.end) {
        allDates.add(r.date);
      }
    });

    // Sort descending
    const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

    return sortedDates.map(dateStr => {
      const rep = reports.find(r => r.date === dateStr);

      return {
        date: dateStr,
        attendanceStatus: rep ? 'Present' : 'Absent',
        timeIn: rep && rep.submittedAt ? formatTimeAmPm(rep.submittedAt) : '-',
        shift: rep?.shift || '-',
        shiftValue: rep?.shiftValue || 0,
        advance: rep?.advance || 0
      };
    });
  }, [reports, dateBounds]);

  // Filtered Daily logs based on Search input
  const filteredDailyLogs = useMemo(() => {
    return dailyLogs.filter(log => {
      const formattedDate = formatReadableDate(log.date);
      return (
        formattedDate.includes(searchTerm) ||
        log.attendanceStatus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.shift.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [dailyLogs, searchTerm]);

  // Compile Weekly group statements
  const weeklyLogs = useMemo(() => {
    const groups: { [key: string]: typeof dailyLogs } = {};
    
    dailyLogs.forEach(log => {
      const weekRange = getWeekRangeString(log.date);
      if (!groups[weekRange]) {
        groups[weekRange] = [];
      }
      groups[weekRange].push(log);
    });

    return Object.keys(groups).map(weekRange => {
      const logs = groups[weekRange];
      const workingDays = logs.filter(l => l.attendanceStatus === 'Present').length;
      const totalShifts = logs.reduce((sum, l) => sum + l.shiftValue, 0);
      const totalAdvance = logs.reduce((sum, l) => sum + l.advance, 0);

      return {
        weekRange,
        workingDays,
        totalShifts,
        totalAdvance
      };
    });
  }, [dailyLogs]);

  // Compile Monthly group statements
  const monthlyLogs = useMemo(() => {
    const groups: { [key: string]: typeof dailyLogs } = {};

    dailyLogs.forEach(log => {
      const monthStr = getMonthString(log.date);
      if (!groups[monthStr]) {
        groups[monthStr] = [];
      }
      groups[monthStr].push(log);
    });

    return Object.keys(groups).map(monthName => {
      const logs = groups[monthName];
      const workingDays = logs.filter(l => l.attendanceStatus === 'Present').length;
      const totalShifts = logs.reduce((sum, l) => sum + l.shiftValue, 0);
      const totalAdvance = logs.reduce((sum, l) => sum + l.advance, 0);

      return {
        monthName,
        totalAttendance: workingDays,
        totalShifts,
        totalAdvance
      };
    });
  }, [dailyLogs]);

  // Grand Totals Summary Card Calculations
  const summaryAggregates = useMemo(() => {
    const workingDays = dailyLogs.filter(l => l.attendanceStatus === 'Present').length;
    const totalShifts = dailyLogs.reduce((sum, l) => sum + l.shiftValue, 0);
    const totalAdvance = dailyLogs.reduce((sum, l) => sum + l.advance, 0);

    return { workingDays, totalShifts, totalAdvance };
  }, [dailyLogs]);

  // Exports Logic
  const handleExportExcel = () => {
    if (!profile) return;
    
    let exportData: any[] = [];
    let filename = `Report_${activeTab}_${profile.employeeId}_${dateBounds.start}_to_${dateBounds.end}`;
    
    if (activeTab === 'daily') {
      exportData = filteredDailyLogs.map(l => ({
        'Date': formatReadableDate(l.date),
        'Status': l.attendanceStatus,
        'Submission Time': l.timeIn,
        'Shift': l.shift,
        'Advance Amount (Rs)': l.advance
      }));
    } else if (activeTab === 'weekly') {
      exportData = weeklyLogs.map(w => ({
        'Week Range': w.weekRange,
        'Working Days': w.workingDays,
        'Total Shifts': w.totalShifts,
        'Total Advance (Rs)': w.totalAdvance
      }));
    } else {
      exportData = monthlyLogs.map(m => ({
        'Month': m.monthName,
        'Working Days': m.totalAttendance,
        'Total Shifts': m.totalShifts,
        'Total Advance (Rs)': m.totalAdvance
      }));
    }

    exportService.exportToExcel(exportData, filename, `${activeTab.toUpperCase()} Statement`);
    toast.success('Excel statement downloaded.');
  };

  const handleExportPDF = () => {
    if (!profile) return;
    
    let headers: string[] = [];
    let rows: any[][] = [];
    let reportTitle = `Employee ${activeTab.toUpperCase()} Statement`;
    let filename = `Report_${activeTab}_${profile.employeeId}_${dateBounds.start}_to_${dateBounds.end}`;
    
    const subtitle = `Company: MP Employee CMS | Employee: ${profile.name} (${profile.employeeId}) | Range: ${formatReadableDate(dateBounds.start)} to ${formatReadableDate(dateBounds.end)}`;

    if (activeTab === 'daily') {
      headers = ['Date', 'Status', 'Time In', 'Shift', 'Advance'];
      rows = filteredDailyLogs.map(l => [
        formatReadableDate(l.date),
        l.attendanceStatus,
        l.timeIn,
        l.shift,
        `Rs ${l.advance}`
      ]);
      rows.push([
        'TOTALS',
        `${summaryAggregates.workingDays} Days`,
        '-',
        `${summaryAggregates.totalShifts} Shifts`,
        `Rs ${summaryAggregates.totalAdvance}`
      ]);
    } else if (activeTab === 'weekly') {
      headers = ['Week Range', 'Working Days', 'Total Shifts', 'Total Advance'];
      rows = weeklyLogs.map(w => [
        w.weekRange,
        `${w.workingDays} Days`,
        w.totalShifts.toString(),
        `Rs ${w.totalAdvance}`
      ]);
      rows.push([
        'TOTALS',
        `${summaryAggregates.workingDays} Days`,
        summaryAggregates.totalShifts.toString(),
        `Rs ${summaryAggregates.totalAdvance}`
      ]);
    } else {
      headers = ['Month', 'Working Days', 'Total Shifts', 'Total Advance'];
      rows = monthlyLogs.map(m => [
        m.monthName,
        `${m.totalAttendance} Days`,
        m.totalShifts.toString(),
        `Rs ${m.totalAdvance}`
      ]);
      rows.push([
        'TOTALS',
        `${summaryAggregates.workingDays} Days`,
        summaryAggregates.totalShifts.toString(),
        `Rs ${summaryAggregates.totalAdvance}`
      ]);
    }

    exportService.exportToPDF(reportTitle, headers, rows, filename, subtitle);
    toast.success('PDF report downloaded.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-sm font-semibold text-slate-500 font-semibold">{t('loading_reports')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('my_reports')}</h2>
          <p className="text-sm text-slate-400 font-medium">{t('viewing_report_history')}</p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <FileDown size={16} />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* Query Error Alert Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 text-xs text-rose-900 font-semibold leading-relaxed flex items-start space-x-3 text-left">
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-bold text-rose-805 mb-0.5">Database Query Exception</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Date Filter & Search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Select Period */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('filter_by')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full py-2.5 px-3 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="today">{t('today') || 'Today'}</option>
              <option value="yesterday">{t('yesterday') || 'Yesterday'}</option>
              <option value="this_week">{t('this_week')}</option>
              <option value="last_week">{t('last_week')}</option>
              <option value="this_month">{t('this_month')}</option>
              <option value="last_month">{t('last_month')}</option>
              <option value="custom">{t('custom_range')}</option>
            </select>
          </div>

          {/* Custom Start Date */}
          {filterType === 'custom' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('start_date')}</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={15} />
                </div>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Custom End Date */}
          {filterType === 'custom' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('end_date')}</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={15} />
                </div>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Working Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('working_days')}</p>
            <p className="text-base font-extrabold text-slate-800">{summaryAggregates.workingDays} Days</p>
          </div>
          <div className="bg-slate-50 text-slate-505 p-2 rounded-lg"><CalendarDays size={16} /></div>
        </div>

        {/* Total Shifts */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('total_shifts')}</p>
            <p className="text-base font-extrabold text-slate-800">{summaryAggregates.totalShifts}</p>
          </div>
          <div className="bg-slate-50 text-slate-505 p-2 rounded-lg"><Award size={16} /></div>
        </div>

        {/* Total Advance */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('todays_advance')}</p>
            <p className="text-base font-extrabold text-rose-650">₹{summaryAggregates.totalAdvance}</p>
          </div>
          <div className="bg-rose-50/50 text-rose-600 p-2 rounded-lg"><Coins size={16} /></div>
        </div>
      </div>

      {/* Navigation Tabs bar */}
      <div className="bg-white p-1.5 border border-slate-100 rounded-2xl shadow-xs flex flex-row shrink-0">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition cursor-pointer ${
            activeTab === 'daily' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-55'
          }`}
        >
          {t('daily_reports')}
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition cursor-pointer ${
            activeTab === 'weekly' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-55'
          }`}
        >
          {t('weekly_statements')}
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition cursor-pointer ${
            activeTab === 'monthly' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-55'
          }`}
        >
          {t('monthly_statements')}
        </button>
      </div>

      {/* Reports Tables */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        {/* Search - Daily only */}
        {activeTab === 'daily' && (
          <div className="p-4 border-b border-slate-100 text-left">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
              />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {activeTab === 'daily' && (
            <table className="min-w-full divide-y divide-slate-100 text-sm font-medium">
              <thead className="bg-slate-55/30">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('attendance_status')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('time_in')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('total_shift')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('advance')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {filteredDailyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                      {t('no_records_found')}
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredDailyLogs.map(l => (
                      <tr key={`daily-${l.date}`} className="hover:bg-slate-50/20 text-left">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">{formatReadableDate(l.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                            l.attendanceStatus === 'Present' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {l.attendanceStatus === 'Present' ? t('attendance_status').split(' ')[0] || 'Present' : 'Absent'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-500">{l.timeIn}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-650">{l.shift}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">{l.advance > 0 ? `₹${l.advance}` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t border-slate-100 text-left">
                      <td className="px-6 py-4 whitespace-nowrap">TOTALS</td>
                      <td className="px-6 py-4 whitespace-nowrap">{summaryAggregates.workingDays} Days</td>
                      <td className="px-6 py-4 whitespace-nowrap">-</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">{summaryAggregates.totalShifts} Shifts</td>
                      <td className="px-6 py-4 whitespace-nowrap text-rose-600">₹{summaryAggregates.totalAdvance}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'weekly' && (
            <table className="min-w-full divide-y divide-slate-100 text-sm font-medium">
              <thead className="bg-slate-55/30">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('weekly_range')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('working_days')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('total_shifts')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('todays_advance')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {weeklyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                      {t('no_records_found')}
                    </td>
                  </tr>
                ) : (
                  <>
                    {weeklyLogs.map(w => (
                      <tr key={`weekly-${w.weekRange}`} className="hover:bg-slate-50/20 text-left">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">{w.weekRange}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{w.workingDays} Days</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono">{w.totalShifts}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">{w.totalAdvance > 0 ? `₹${w.totalAdvance}` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t border-slate-100 text-left">
                      <td className="px-6 py-4 whitespace-nowrap">TOTALS</td>
                      <td className="px-6 py-4 whitespace-nowrap">{summaryAggregates.workingDays} Days</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">{summaryAggregates.totalShifts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-rose-650">₹{summaryAggregates.totalAdvance}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'monthly' && (
            <table className="min-w-full divide-y divide-slate-100 text-sm font-medium">
              <thead className="bg-slate-55/30">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('month')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('working_days')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('total_shifts')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('todays_advance')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {monthlyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                      {t('no_records_found')}
                    </td>
                  </tr>
                ) : (
                  <>
                    {monthlyLogs.map(m => (
                      <tr key={`monthly-${m.monthName}`} className="hover:bg-slate-50/20 text-left">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-700">{m.monthName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{m.totalAttendance} Days</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono">{m.totalShifts}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">{m.totalAdvance > 0 ? `₹${m.totalAdvance}` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t border-slate-100 text-left">
                      <td className="px-6 py-4 whitespace-nowrap">TOTALS</td>
                      <td className="px-6 py-4 whitespace-nowrap">{summaryAggregates.workingDays} Days</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">{summaryAggregates.totalShifts}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-rose-655">₹{summaryAggregates.totalAdvance}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
export default MyReports;
