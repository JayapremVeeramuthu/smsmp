import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { reportService } from '../../services/reportService';
import { formatDateString, formatReadableDate, formatTimeAmPm } from '../../utils/dateHelpers';
import type { DailyReport } from '../../types';
import { Clock, Calendar, CheckCircle2, Send, Loader2, Award, Coins, AlertTriangle, PenTool } from 'lucide-react';
import toast from 'react-hot-toast';

export const EmployeeDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [time, setTime] = useState(new Date());
  
  // States for daily report
  const [report, setReport] = useState<DailyReport | null>(null);
  const [correctionRequest, setCorrectionRequest] = useState<any>(null);
  
  const [shift, setShift] = useState<'S' | 'SI' | 'SII' | 'SIII' | 'SIIII'>('S');
  const [advance, setAdvance] = useState<string>('');
  
  const [submittingReport, setSubmittingReport] = useState(false);
  const [loadingStates, setLoadingStates] = useState(true);

  // States for Correction Request modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('Wrong Shift');
  const [otherReason, setOtherReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const todayStr = formatDateString(new Date());

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's records
  useEffect(() => {
    if (!profile?.employeeId) return;

    let unsubReport: (() => void) | null = null;
    let unsubRequest: (() => void) | null = null;

    const fetchTodayStatus = async () => {
      try {
        setLoadingStates(true);
        // Subscribe to today's report for this employee
        unsubReport = reportService.subscribeToEmployeeReports(profile.employeeId, (records) => {
          const todayRecord = records.find(r => r.date === todayStr);
          setReport(todayRecord || null);
          if (todayRecord) {
            setShift(todayRecord.shift);
            setAdvance(todayRecord.advance.toString());
          } else {
            // Reset to defaults if no record exists
            setShift('S');
            setAdvance('');
          }
          setLoadingStates(false);
        }, (err) => {
          console.error(err);
          toast.error(t('load_status_failed'));
          setLoadingStates(false);
        });

        // Subscribe to correction requests for today
        const reportId = reportService.getDocId(profile.employeeId, todayStr);
        unsubRequest = reportService.subscribeToCorrectionRequest(reportId, (req) => {
          setCorrectionRequest(req || null);
        });
      } catch (err: any) {
        console.error(err);
        toast.error(t('load_status_failed'));
        setLoadingStates(false);
      }
    };

    fetchTodayStatus();

    return () => {
      if (unsubReport) unsubReport();
      if (unsubRequest) unsubRequest();
    };
  }, [profile?.employeeId, todayStr, t]);

  // Submit End of Day Report
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.employeeId) return;
    setSubmittingReport(true);
    try {
      const advanceNum = advance.trim() === '' ? 0 : Number(advance);
      if (isNaN(advanceNum) || advanceNum < 0) {
        throw new Error(t('valid_advance'));
      }

      if (report && correctionRequest?.status === 'Approved') {
        // Submit corrected report via batch write
        await reportService.submitCorrectedReport(
          profile.employeeId,
          todayStr,
          shift,
          advanceNum,
          correctionRequest
        );
        toast.success(t('details_corrected') || 'Report corrected and locked!');
      } else {
        // Standard first-time submission
        await reportService.submitDailyReport(
          profile.employeeId,
          todayStr,
          shift,
          advanceNum,
          'employee'
        );
        toast.success(t('report_submit_success'));
      }
    } catch (err: any) {
      toast.error(err.message || t('report_submit_failed'));
    } finally {
      setSubmittingReport(false);
    }
  };

  // Submit Correction Request
  const handleRequestCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.employeeId) return;
    setSubmittingRequest(true);
    try {
      const finalReason = reason === t('other') ? otherReason : reason;
      const reportId = reportService.getDocId(profile.employeeId, todayStr);
      await reportService.submitCorrectionRequest(
        profile.employeeId,
        profile.name,
        reportId,
        todayStr,
        finalReason
      );
      toast.success(t('correction_requested_success'));
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || t('correction_requested_failed'));
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loadingStates) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
        <p className="text-sm font-semibold text-slate-500 font-medium">{t('loading_status')}</p>
      </div>
    );
  }

  // Determine if the form should be locked/disabled
  const isFormDisabled = report !== null && (!correctionRequest || correctionRequest.status !== 'Approved');

  return (
    <div className="space-y-6">
      {/* Date & Time Widget */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl">
            <Calendar size={24} />
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('todays_date')}</p>
            <p className="text-lg font-bold text-slate-800">{formatReadableDate(todayStr)}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3.5">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
            <Clock size={24} />
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('current_time')}</p>
            <p className="text-lg font-bold text-slate-800 font-mono">{time.toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today's Shift */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="text-left">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t('todays_shift')}</p>
            <p className="text-base font-extrabold text-slate-850">
              {report ? `${report.shift} (${report.shiftValue} Shift)` : t('not_submitted')}
            </p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <Award size={20} />
          </div>
        </div>

        {/* Today's Advance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="text-left">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t('todays_advance')}</p>
            <p className="text-base font-extrabold text-rose-600">
              {report ? `₹${report.advance}` : '₹0'}
            </p>
          </div>
          <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl">
            <Coins size={20} />
          </div>
        </div>
      </div>

      {/* Centered End of Day Report Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-xs text-left space-y-6">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-1.5">{t('end_of_day_report')}</h3>
            <p className="text-sm text-slate-405 font-medium">{t('description_eod')}</p>
          </div>

          {/* Submission status banner / correction banner */}
          {report && (
            <div className="space-y-4">
              {/* Green submitted banner */}
              {(!correctionRequest || correctionRequest.status === 'Completed' || correctionRequest.status === 'Rejected') && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center justify-center text-center space-y-2 text-emerald-800 animate-fade-in">
                  <div className="bg-emerald-500 text-white p-2 rounded-full shadow-xs">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold">
                      ✔ {t('success_message')}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">
                      {t('submitted_at')} <span className="font-bold font-mono">{formatTimeAmPm(report.submittedAt)}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Status specific notices */}
              {correctionRequest?.status === 'Pending' && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center space-x-3 text-amber-800">
                  <Clock size={20} className="text-amber-600 shrink-0" />
                  <p className="text-sm font-bold">{t('request_pending')}</p>
                </div>
              )}

              {correctionRequest?.status === 'Approved' && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center space-x-3 text-blue-800 animate-pulse">
                  <PenTool size={20} className="text-blue-600 shrink-0" />
                  <p className="text-sm font-bold">{t('request_approved')}</p>
                </div>
              )}

              {correctionRequest?.status === 'Rejected' && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center space-x-3 text-rose-800">
                  <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                  <p className="text-sm font-bold">{t('request_rejected')}</p>
                </div>
              )}

              {correctionRequest?.status === 'Completed' && (
                <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl flex items-center space-x-3 text-emerald-800">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <p className="text-sm font-bold">{t('request_completed')}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleReportSubmit} className="space-y-5">
            {/* Shift Select */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('total_shift')}</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                disabled={isFormDisabled || submittingReport}
                className="block w-full py-2.5 px-3.5 border border-slate-200 bg-slate-50/50 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition duration-150"
              >
                <option value="S">{t('shift_option_s')}</option>
                <option value="SI">{t('shift_option_si')}</option>
                <option value="SII">{t('shift_option_sii')}</option>
                <option value="SIII">{t('shift_option_siii')}</option>
                <option value="SIIII">{t('shift_option_siiii')}</option>
              </select>
            </div>

            {/* Advance Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('advance_amount')}</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                  ₹
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  disabled={isFormDisabled || submittingReport}
                  className="block w-full pl-8 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 transition duration-150"
                />
              </div>
            </div>

            {/* Submit Button */}
            {report ? (
              correctionRequest?.status === 'Approved' ? (
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-750 transition cursor-pointer"
                >
                  {submittingReport ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{t('submit_day_report')}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={true}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-slate-400 bg-slate-100/85 cursor-not-allowed border-slate-200/50 transition duration-150"
                  >
                    <CheckCircle2 size={16} />
                    <span>{t('report_submitted')}</span>
                  </button>

                  {/* Show Request Correction button if no pending/approved request exists */}
                  {(!correctionRequest || correctionRequest.status === 'Rejected') && (
                    <button
                      type="button"
                      onClick={() => {
                        setReason('Wrong Shift');
                        setOtherReason('');
                        setDialogOpen(true);
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 border border-blue-600 text-blue-600 hover:bg-blue-50/40 rounded-xl text-sm font-bold transition cursor-pointer"
                    >
                      <span>{t('request_correction')}</span>
                    </button>
                  )}
                </div>
              )
            ) : (
              <button
                type="submit"
                disabled={submittingReport}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
              >
                {submittingReport ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <Send size={16} />
                    <span>{t('submit_day_report')}</span>
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Correction Request Dialog Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 text-left space-y-4 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-805">{t('correction_reason')}</h3>
            
            <form onSubmit={handleRequestCorrectionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('correction_reason')}</label>
                <div className="space-y-2">
                  {[t('wrong_shift'), t('wrong_advance'), t('wrong_date'), t('other')].map((opt) => (
                    <label key={opt} className="flex items-center space-x-2.5 p-2 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/50 transition">
                      <input
                        type="radio"
                        name="reason"
                        value={opt}
                        checked={reason === opt}
                        onChange={() => setReason(opt)}
                        className="text-indigo-650 focus:ring-indigo-500"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reason === t('other') && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('other')}</label>
                  <textarea
                    required
                    placeholder="Enter reason..."
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingRequest ? <Loader2 className="animate-spin" size={16} /> : <span>{t('submit_request')}</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
