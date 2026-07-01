import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employeeService';
import { reportService } from '../../services/reportService';
import type { Employee } from '../../types';
import { formatDateString } from '../../utils/dateHelpers';
import { User, Calendar, Clock, Award, CheckCircle, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const ManualEntry: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [date, setDate] = useState(formatDateString(new Date()));
  const [shift, setShift] = useState<'S' | 'SI' | 'SII' | 'SIII' | 'SIIII'>('S');
  const [advance, setAdvance] = useState('');
  const [overtime, setOvertime] = useState('0');
  const [remarks, setRemarks] = useState('Manual override by admin');
  const [saving, setSaving] = useState(false);

  // Load active employees list
  useEffect(() => {
    const unsubscribe = employeeService.subscribeToEmployees((data) => {
      const activeOnly = data.filter(e => e.status === 'active');
      setEmployees(activeOnly);
      if (activeOnly.length > 0) {
        setSelectedEmpId(activeOnly[0].employeeId);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error('Please select an employee.');
      return;
    }
    setSaving(true);
    try {
      const selectedEmp = employees.find(emp => emp.employeeId === selectedEmpId);
      const empName = selectedEmp?.name || '';

      const advanceNum = advance.trim() === '' ? 0 : Number(advance);
      const overtimeNum = overtime.trim() === '' ? 0 : Number(overtime);

      if (isNaN(advanceNum) || advanceNum < 0) {
        throw new Error('Please enter a valid advance amount.');
      }
      if (isNaN(overtimeNum) || overtimeNum < 0) {
        throw new Error('Please enter a valid overtime duration.');
      }
      
      await reportService.submitAdminManualShiftReport({
        employeeId: selectedEmpId,
        employeeName: empName,
        date,
        shift,
        advance: advanceNum,
        overtime: overtimeNum,
        remarks: remarks || 'Manual override',
        adminUserId: user?.uid || 'admin'
      });
      
      toast.success(`Shift & Advance logged for ${selectedEmpId} on ${date}.`);
      setAdvance('');
      setOvertime('0');
      setRemarks('Manual override by admin');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shift log.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-sm font-semibold text-slate-500">Loading directory info...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800">Shift & Advance Override</h2>
        <p className="text-sm text-slate-400 font-medium">Manually create or correct shift reports and advance entries.</p>
      </div>

      {/* Override Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        {employees.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-semibold text-slate-400">Please create an active employee account first.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {/* Employee & Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Employee</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><User size={15} /></div>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="block w-full pl-9 pr-8 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    {employees.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Date</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Calendar size={15} /></div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Shift, Advance & Overtime Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Shift Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Award size={15} /></div>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="block w-full pl-9 pr-8 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  >
                    <option value="S">S (1.0 Shift)</option>
                    <option value="SI">SI (1.5 Shifts)</option>
                    <option value="SII">SII (2.0 Shifts)</option>
                    <option value="SIII">SIII (2.5 Shifts)</option>
                    <option value="SIIII">SIIII (3.0 Shifts)</option>
                  </select>
                </div>
              </div>

              {/* Advance Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Advance Amount (₹)</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">₹</div>
                  <input
                    type="number"
                    placeholder="0"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    className="block w-full pl-8 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Overtime */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Overtime Hours</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Clock size={15} /></div>
                  <input
                    type="number"
                    placeholder="0"
                    value={overtime}
                    onChange={(e) => setOvertime(e.target.value)}
                    className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><MessageSquare size={15} /></div>
                <input
                  type="text"
                  placeholder="Remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                <span>Save Shift Report</span>
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Notice alert */}
      <div className="bg-amber-50/50 border border-amber-250 rounded-2xl p-4 text-xs text-amber-900 font-semibold leading-relaxed flex items-start space-x-3 text-left">
        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
        <div>
          <p className="font-bold text-amber-805 mb-1">Audit Isolation Rule:</p>
          <p>This override panel writes exclusively to the `admin_manual_shift_reports` collection. It will <strong>never</strong> modify or overwrite the employee's self-submitted portal records. Complete audit histories and admin user IDs are recorded for full visibility.</p>
        </div>
      </div>
    </div>
  );
};
export default ManualEntry;
