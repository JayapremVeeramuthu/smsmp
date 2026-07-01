import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { reportService } from '../../services/reportService';
import { formatReadableDate } from '../../utils/dateHelpers';
import type { DailyReport } from '../../types';
import { Loader2, Check, X, AlertTriangle, Key, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export const CorrectionRequests: React.FC = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [reportsMap, setReportsMap] = useState<Record<string, DailyReport | null>>({});
  const [loading, setLoading] = useState(true);

  // Modal States
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [approving, setApproving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Subscribe to all correction requests
    const unsub = reportService.subscribeAllCorrectionRequests((reqs) => {
      // Filter for Pending status only
      const pending = reqs.filter(r => r.status === 'Pending');
      setRequests(pending);

      // Fetch report details for each pending request
      pending.forEach(async (req) => {
        if (reportsMap[req.requestId] === undefined) {
          try {
            const report = await reportService.getEmployeeReportForDate(req.employeeId, req.date);
            setReportsMap(prev => ({
              ...prev,
              [req.requestId]: report
            }));
          } catch (err) {
            console.error(err);
          }
        }
      });
      setLoading(false);
    });

    return () => unsub();
  }, [reportsMap]);

  const handleOpenApproveModal = (req: any) => {
    setActiveRequest(req);
    setAdminPassword('');
    setErrorMsg('');
    setConfirmModalOpen(true);
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !user?.email || !profile?.uid) return;
    setApproving(true);
    setErrorMsg('');
    try {
      await reportService.approveCorrectionRequest(
        activeRequest.requestId,
        adminPassword,
        user.email,
        profile.uid
      );
      toast.success('Correction request approved successfully!');
      setConfirmModalOpen(false);
      setActiveRequest(null);
      setAdminPassword('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Verification failed.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (req: any) => {
    if (!profile?.uid) return;
    const confirmReject = window.confirm(`Are you sure you want to reject the correction request for ${req.employeeName} on ${formatReadableDate(req.date)}?`);
    if (!confirmReject) return;

    try {
      await reportService.rejectCorrectionRequest(req.requestId, profile.uid);
      toast.success('Correction request rejected.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
        <p className="text-sm font-semibold text-slate-500">Loading pending requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800">Correction Requests</h2>
        <p className="text-sm text-slate-400 font-medium">Review and manage employee requests to correct submitted EOD shift reports.</p>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm font-medium">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Current Submitted Report</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                    No pending correction requests found.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const currentReport = reportsMap[req.requestId];
                  return (
                    <tr key={req.requestId} className="hover:bg-slate-50/20 text-left">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{req.employeeName}</div>
                        <div className="text-xs text-slate-400 font-mono">{req.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-bold">
                        {formatReadableDate(req.date)}
                      </td>
                      <td className="px-6 py-4">
                        {currentReport === undefined ? (
                          <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Loading report...</span>
                          </div>
                        ) : currentReport ? (
                          <div className="text-xs space-y-0.5 text-slate-650 font-bold text-left">
                            <div>Shift: <span className="text-slate-800">{currentReport.shift} ({currentReport.shiftValue} Value)</span></div>
                            <div>Advance: <span className="text-rose-600 font-bold">₹{currentReport.advance}</span></div>
                            <div>Earnings: <span className="text-emerald-600 font-bold">₹{currentReport.dailyEarnings}</span></div>
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs font-bold">No report found</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 max-w-xs break-words">
                        {req.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-100">
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="inline-flex space-x-2">
                          <button
                            onClick={() => handleOpenApproveModal(req)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <Check size={12} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <X size={12} />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Confirmation Modal */}
      {confirmModalOpen && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 text-left space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-amber-650">
              <div className="bg-amber-50 p-2 rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-805">Security Password Required</h3>
            </div>
            
            <p className="text-xs text-slate-400 font-medium">
              You are approving the correction request for <span className="font-bold text-slate-700">{activeRequest.employeeName}</span> on <span className="font-bold text-slate-700">{formatReadableDate(activeRequest.date)}</span>. Please verify your admin password to proceed.
            </p>

            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Admin Password</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="block w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center space-x-2 text-red-805 text-xs font-bold">
                  <AlertTriangle size={14} className="text-red-600 shrink-0" />
                  <span>{errorMsg === "Invalid Admin Password." ? "Invalid Admin Password." : errorMsg}</span>
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {approving ? <Loader2 className="animate-spin" size={16} /> : <span>Confirm Approval</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectionRequests;
