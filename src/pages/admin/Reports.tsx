import React, { useState, useEffect } from 'react';
import { employeeService } from '../../services/employeeService';
import { reportService } from '../../services/reportService';
import { exportService } from '../../services/exportService';
import type { Employee, DailyReport } from '../../types';
import { formatDateString, getDateRange, formatReadableDate } from '../../utils/dateHelpers';
import { 
  FileSpreadsheet, 
  FileDown, 
  Search, 
  Loader2,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Reports: React.FC = () => {
  // Filters
  const [filterType, setFilterType] = useState<string>('this_week');
  const [sourceFilter, setSourceFilter] = useState<'employee' | 'admin'>('employee');
  const [customRange, setCustomRange] = useState({
    startDate: formatDateString(new Date()),
    endDate: formatDateString(new Date())
  });

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch employees on mount
  useEffect(() => {
    const unsubscribe = employeeService.subscribeToEmployees((data) => {
      setEmployees(data);
    });
    return () => unsubscribe();
  }, []);

  // Fetch reports when filters change
  const loadReportData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(filterType, customRange);
      
      const repData = await reportService.getReportsInRange(start, end, sourceFilter);
      setReports(repData);
    } catch (err: any) {
      toast.error('Failed to compile reports data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [filterType, sourceFilter, customRange.startDate, customRange.endDate]);

  // Aggregate stats per employee for the selected range and source
  const summaryData = React.useMemo(() => {
    return employees.map((emp) => {
      // Filter records
      const empReports = reports.filter(r => r.employeeId === emp.employeeId);

      // Calculations
      const workingDays = empReports.length;
      const totalShifts = empReports.reduce((sum, r) => sum + r.shiftValue, 0);
      const grossEarnings = totalShifts * emp.shiftRate;
      const totalAdvance = empReports.reduce((sum, r) => sum + r.advance, 0);
      const finalSalary = grossEarnings - totalAdvance;

      return {
        uid: emp.uid,
        employeeId: emp.employeeId,
        name: emp.name,
        shiftRate: emp.shiftRate,
        workingDays,
        totalShifts,
        grossEarnings,
        totalAdvance,
        finalSalary
      };
    });
  }, [employees, reports]);

  // Filtered summaries for search
  const filteredSummaries = summaryData.filter(summary => 
    summary.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    summary.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Total summary aggregates
  const grandTotals = React.useMemo(() => {
    return filteredSummaries.reduce((totals, item) => ({
      workingDays: totals.workingDays + item.workingDays,
      totalShifts: totals.totalShifts + item.totalShifts,
      grossEarnings: totals.grossEarnings + item.grossEarnings,
      totalAdvance: totals.totalAdvance + item.totalAdvance,
      finalSalary: totals.finalSalary + item.finalSalary,
    }), { workingDays: 0, totalShifts: 0, grossEarnings: 0, totalAdvance: 0, finalSalary: 0 });
  }, [filteredSummaries]);

  // Export functions
  const handleExportExcel = () => {
    const { start, end } = getDateRange(filterType, customRange);
    const exportData = filteredSummaries.map(s => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.name,
      'Shift Rate (Rs)': s.shiftRate,
      'Working Days': s.workingDays,
      'Total Shifts': s.totalShifts,
      'Gross Earnings (Rs)': s.grossEarnings,
      'Advance Taken (Rs)': s.totalAdvance,
      'Net Salary (Rs)': s.finalSalary,
      'Report Source': sourceFilter === 'employee' ? 'Employee Portal' : 'Admin Manual'
    }));

    exportService.exportToExcel(
      exportData, 
      `Salary_Report_${sourceFilter}_${start}_to_${end}`,
      'Salary Summary'
    );
    toast.success('Excel file downloaded.');
  };

  const handleExportPDF = () => {
    const { start, end } = getDateRange(filterType, customRange);
    const headers = [
      'Emp ID', 
      'Name', 
      'Rate', 
      'Days', 
      'Shifts', 
      'Gross (Rs)', 
      'Advance (Rs)', 
      'Net Salary (Rs)'
    ];

    const rows = filteredSummaries.map(s => [
      s.employeeId,
      s.name,
      `Rs ${s.shiftRate}`,
      s.workingDays,
      s.totalShifts,
      `Rs ${s.grossEarnings}`,
      `Rs ${s.totalAdvance}`,
      `Rs ${s.finalSalary}`
    ]);

    // Append total row
    rows.push([
      'TOTALS',
      `${filteredSummaries.length} Employees`,
      '-',
      grandTotals.workingDays.toString(),
      grandTotals.totalShifts.toString(),
      `Rs ${grandTotals.grossEarnings}`,
      `Rs ${grandTotals.totalAdvance}`,
      `Rs ${grandTotals.finalSalary}`
    ]);

    exportService.exportToPDF(
      `Company Salary Summary - ${sourceFilter === 'employee' ? 'Employee Portal' : 'Admin Manual'}`,
      headers,
      rows,
      `Salary_Report_${sourceFilter}_${start}_to_${end}`,
      `Billing Statement Source: ${sourceFilter === 'employee' ? 'Employee Portal' : 'Admin Manual'} | Range: ${formatReadableDate(start)} to ${formatReadableDate(end)}`
    );
    toast.success('PDF downloaded.');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Salary & Shift Statements</h2>
          <p className="text-sm text-slate-400 font-medium">Generate, filter, and review payroll statistics across portal and manual logs.</p>
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

      {/* Date & Source Filter Widgets */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Select Period */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Period</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full py-2.5 px-3 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Select Records Source */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="block w-full py-2.5 px-3 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              <option value="employee">Employee Portal Reports</option>
              <option value="admin">Admin Manual Shift Reports</option>
            </select>
          </div>

          {/* Custom Date Ranges */}
          {filterType === 'custom' && (
            <div className="grid grid-cols-2 gap-2 md:col-span-1">
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">Start</label>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="block w-full py-2 px-3 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase mb-1">End</label>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="block w-full py-2 px-3 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List Table with Search Filter */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-slate-100 text-left">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Filter statement by name or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-sm font-semibold text-slate-500 font-semibold">Compiling and aggregating statistics...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm font-medium">
              <thead className="bg-slate-55/30">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rate</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Report Source</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Working Days</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Shifts Completed</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Salary</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Advance Deductions</th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Net Payable</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                      No records found in this range.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredSummaries.map((summary) => (
                      <tr key={summary.uid} className="hover:bg-slate-50/20 text-left">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{summary.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{summary.employeeId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                          ₹{summary.shiftRate}/shift
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xxs font-extrabold rounded-full border items-center space-x-1 ${
                            sourceFilter === 'employee' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-amber-50 text-amber-750 border-amber-250'
                          }`}>
                            {sourceFilter === 'employee' ? <UserCheck size={11} className="mr-0.5" /> : <ShieldCheck size={11} className="mr-0.5" />}
                            <span>
                              {sourceFilter === 'employee' ? 'Employee Portal' : 'Admin Manual'}
                            </span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          {summary.workingDays} Days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-650 font-mono">
                          {summary.totalShifts} Shifts
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                          ₹{summary.grossEarnings}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">
                          {summary.totalAdvance > 0 ? `-₹${summary.totalAdvance}` : '₹0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-extrabold text-blue-600">
                          ₹{summary.finalSalary}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Total Row */}
                    <tr className="bg-slate-55/10 font-bold text-slate-800 border-t-2 border-slate-100 text-left">
                      <td className="px-6 py-4 whitespace-nowrap">TOTALS</td>
                      <td className="px-6 py-4 whitespace-nowrap">-</td>
                      <td className="px-6 py-4 whitespace-nowrap">-</td>
                      <td className="px-6 py-4 whitespace-nowrap">{grandTotals.workingDays} Days</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono">{grandTotals.totalShifts} Shifts</td>
                      <td className="px-6 py-4 whitespace-nowrap">₹{grandTotals.grossEarnings}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-rose-650">-₹{grandTotals.totalAdvance}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-extrabold text-blue-700">₹{grandTotals.finalSalary}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default Reports;
