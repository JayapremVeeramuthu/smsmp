import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { db, createSecondaryAuth } from '../firebase/config';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { DailyReport, AdminManualShiftReport } from '../types';
import { employeeService } from './employeeService';

export const SHIFT_MAP = {
  'S': 1.0,
  'SI': 1.5,
  'SII': 2.0,
  'SIII': 2.5,
  'SIIII': 3.0
};

export const reportService = {
  /**
   * Get unique document ID for daily reports
   */
  getDocId(employeeId: string, date: string): string {
    return `${employeeId.trim().toUpperCase()}_${date}`;
  },

  /**
   * Submit EOD report from Employee Portal (writes ONLY to employee_shift_reports)
   */
  async submitDailyReport(
    employeeId: string, 
    date: string, 
    shift: 'S' | 'SI' | 'SII' | 'SIII' | 'SIIII', 
    advance: number = 0,
    submittedBy: 'employee' = 'employee'
  ) {
    // 1. Fetch employee to get shiftRate
    const employee = await employeeService.getEmployeeById(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID "${employeeId}" not found.`);
    }

    const shiftValue = SHIFT_MAP[shift];
    const dailyEarnings = shiftValue * employee.shiftRate;
    const netAmount = dailyEarnings - advance;

    const docId = this.getDocId(employeeId, date);
    const docRef = doc(db, 'employee_shift_reports', docId);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      throw new Error("You have already submitted today's work report.");
    }

    const report = {
      employeeId: employeeId.trim().toUpperCase(),
      date,
      shift,
      shiftValue,
      advance,
      dailyEarnings,
      netAmount,
      submittedBy,
      submittedAt: Timestamp.now(),
      entryType: 'portal'
    };

    await setDoc(docRef, report);
    return report;
  },

  /**
   * Submit Admin Manual Shift Report (writes ONLY to admin_manual_shift_reports)
   */
  async submitAdminManualShiftReport(data: {
    employeeId: string;
    employeeName: string;
    date: string;
    shift: 'S' | 'SI' | 'SII' | 'SIII' | 'SIIII';
    advance: number;
    overtime: number;
    remarks: string;
    adminUserId: string;
  }) {
    // Fetch employee to calculate earnings
    const employee = await employeeService.getEmployeeById(data.employeeId);
    if (!employee) {
      throw new Error(`Employee with ID "${data.employeeId}" not found.`);
    }

    const shiftCount = SHIFT_MAP[data.shift];
    const dailyEarnings = shiftCount * employee.shiftRate;
    const netAmount = dailyEarnings - data.advance;

    const docId = this.getDocId(data.employeeId, data.date);
    const docRef = doc(db, 'admin_manual_shift_reports', docId);

    const docSnap = await getDoc(docRef);
    const now = Timestamp.now();
    const createdAt = docSnap.exists() ? docSnap.data().createdAt : now;

    const manualReport: AdminManualShiftReport = {
      employeeId: data.employeeId.trim().toUpperCase(),
      employeeName: data.employeeName,
      date: data.date,
      shift: data.shift,
      shiftCount,
      overtime: data.overtime,
      advance: data.advance,
      remarks: data.remarks,
      submittedBy: 'admin',
      entryType: 'manual',
      createdAt,
      updatedAt: now,
      adminUserId: data.adminUserId,
      dailyEarnings,
      netAmount
    };

    await setDoc(docRef, manualReport);
    return manualReport;
  },

  /**
   * Get report for a specific employee on a specific date from employee_shift_reports
   */
  async getEmployeeReportForDate(employeeId: string, date: string): Promise<DailyReport | null> {
    const docId = this.getDocId(employeeId, date);
    const docSnap = await getDoc(doc(db, 'employee_shift_reports', docId));
    if (docSnap.exists()) {
      return docSnap.data() as DailyReport;
    }
    return null;
  },

  /**
   * Get manual report for a specific employee on a specific date from admin_manual_shift_reports
   */
  async getAdminManualReportForDate(employeeId: string, date: string): Promise<AdminManualShiftReport | null> {
    const docId = this.getDocId(employeeId, date);
    const docSnap = await getDoc(doc(db, 'admin_manual_shift_reports', docId));
    if (docSnap.exists()) {
      return docSnap.data() as AdminManualShiftReport;
    }
    return null;
  },

  /**
   * Subscribe to all daily reports (merged) for a specific date (real-time)
   */
  subscribeToDateReports(date: string, callback: (reports: DailyReport[]) => void) {
    let empReports: DailyReport[] = [];
    let adminReports: DailyReport[] = [];

    const notify = () => {
      const merged = [...empReports];
      // Override or append admin logs
      adminReports.forEach(adminLog => {
        const existingIdx = merged.findIndex(m => m.employeeId === adminLog.employeeId);
        if (existingIdx !== -1) {
          merged.push(adminLog);
        } else {
          merged.push(adminLog);
        }
      });
      callback(merged);
    };

    const qEmp = query(collection(db, 'employee_shift_reports'), where('date', '==', date));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      empReports = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        empReports.push({
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
      notify();
    });

    const qAdmin = query(collection(db, 'admin_manual_shift_reports'), where('date', '==', date));
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      adminReports = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        adminReports.push({
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
      notify();
    });

    return () => {
      unsubEmp();
      unsubAdmin();
    };
  },

  /**
   * Subscribe to employee's own portal daily reports (real-time, client-side sorting)
   */
  subscribeToEmployeeReports(
    employeeId: string, 
    callback: (reports: DailyReport[]) => void,
    errorCallback?: (error: any) => void
  ) {
    const q = query(
      collection(db, 'employee_shift_reports'),
      where('employeeId', '==', employeeId.trim().toUpperCase())
    );
    return onSnapshot(q, (snapshot) => {
      const reports: DailyReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        reports.push({
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
      // Sort client-side descending by date
      reports.sort((a, b) => b.date.localeCompare(a.date));
      callback(reports);
    }, (error) => {
      console.error("Failed to subscribe to employee reports:", error);
      if (errorCallback) errorCallback(error);
    });
  },

  /**
   * Subscribe to all admin manual shift reports (Sorted client-side to avoid index requirements)
   */
  subscribeToAdminManualReports(
    employeeId?: string, 
    callback?: (records: AdminManualShiftReport[]) => void,
    errorCallback?: (error: any) => void
  ) {
    const collRef = collection(db, 'admin_manual_shift_reports');
    const q = employeeId 
      ? query(collRef, where('employeeId', '==', employeeId.trim().toUpperCase()))
      : query(collRef);

    return onSnapshot(q, (snapshot) => {
      const records: AdminManualShiftReport[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ id: docSnap.id, ...docSnap.data() } as AdminManualShiftReport);
      });
      // Sort client-side descending by date
      records.sort((a, b) => b.date.localeCompare(a.date));
      if (callback) callback(records);
    }, (error) => {
      console.error("Failed to subscribe to admin manual reports:", error);
      if (errorCallback) errorCallback(error);
    });
  },

  /**
   * Fetch daily reports in range (filterable by source)
   */
  async getReportsInRange(
    startDate: string, 
    endDate: string, 
    source: 'employee' | 'admin' | 'combined' = 'combined'
  ): Promise<DailyReport[]> {
    const results: DailyReport[] = [];

    if (source === 'employee' || source === 'combined') {
      const qEmp = query(
        collection(db, 'employee_shift_reports'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snap = await getDocs(qEmp);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        results.push({
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
    }

    if (source === 'admin' || source === 'combined') {
      const qAdmin = query(
        collection(db, 'admin_manual_shift_reports'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snap = await getDocs(qAdmin);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        results.push({
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
    }

    // Sort descending by date
    return results.sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Submit Correction Request
   */
  async submitCorrectionRequest(
    employeeId: string,
    employeeName: string,
    reportId: string,
    date: string,
    reason: string
  ) {
    const docRef = doc(db, 'correction_requests', reportId);
    const request = {
      requestId: reportId,
      employeeId: employeeId.trim().toUpperCase(),
      employeeName,
      reportId,
      date,
      reason,
      status: 'Pending',
      requestedAt: Timestamp.now()
    };
    await setDoc(docRef, request);
    return request;
  },

  /**
   * Subscribe to correction request for a specific reportId
   */
  subscribeToCorrectionRequest(reportId: string, callback: (req: any) => void) {
    const docRef = doc(db, 'correction_requests', reportId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    });
  },

  /**
   * Subscribe to all correction requests (usually for admin)
   */
  subscribeAllCorrectionRequests(callback: (reqs: any[]) => void) {
    const q = query(
      collection(db, 'correction_requests')
    );
    return onSnapshot(q, (snapshot) => {
      const reqs: any[] = [];
      snapshot.forEach((docSnap) => {
        reqs.push(docSnap.data());
      });
      // Sort client-side descending by requestedAt
      reqs.sort((a, b) => {
        const tA = a.requestedAt?.toMillis ? a.requestedAt.toMillis() : 0;
        const tB = b.requestedAt?.toMillis ? b.requestedAt.toMillis() : 0;
        return tB - tA;
      });
      callback(reqs);
    });
  },

  /**
   * Approve a correction request (requires entering correct admin password)
   */
  async approveCorrectionRequest(
    requestId: string,
    password: string,
    adminEmail: string,
    adminUid: string
  ) {
    // 1. Reauthenticate admin using secondary Auth instance
    const { secondaryApp, secondaryAuth } = createSecondaryAuth();
    try {
      await signInWithEmailAndPassword(secondaryAuth, adminEmail, password);
      // Clean up session
      await signOut(secondaryAuth);
    } catch (err) {
      throw new Error("Invalid Admin Password.");
    } finally {
      await deleteApp(secondaryApp);
    }

    // 2. Update status of request in Firestore
    const docRef = doc(db, 'correction_requests', requestId);
    await setDoc(docRef, {
      status: 'Approved',
      approvedAt: Timestamp.now(),
      adminUserId: adminUid
    }, { merge: true });
  },

  /**
   * Reject a correction request (no password check needed)
   */
  async rejectCorrectionRequest(requestId: string, adminUid: string) {
    const docRef = doc(db, 'correction_requests', requestId);
    await setDoc(docRef, {
      status: 'Rejected',
      rejectedAt: Timestamp.now(),
      adminUserId: adminUid
    }, { merge: true });
  },

  /**
   * Submit corrected EOD report from Employee Portal (Batch update)
   */
  async submitCorrectedReport(
    employeeId: string,
    date: string,
    shift: 'S' | 'SI' | 'SII' | 'SIII' | 'SIIII',
    advance: number,
    requestData: any
  ) {
    const employee = await employeeService.getEmployeeById(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID "${employeeId}" not found.`);
    }

    const shiftValue = SHIFT_MAP[shift];
    const dailyEarnings = shiftValue * employee.shiftRate;
    const netAmount = dailyEarnings - advance;

    const reportId = this.getDocId(employeeId, date);
    const reportRef = doc(db, 'employee_shift_reports', reportId);

    // Fetch original report for audit log
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) {
      throw new Error("Original report not found. Cannot perform correction.");
    }
    const originalReport = reportSnap.data();

    const correctedReport = {
      ...originalReport,
      shift,
      shiftValue,
      advance,
      dailyEarnings,
      netAmount,
      correctedAt: Timestamp.now(),
      entryType: 'portal'
    };

    const requestRef = doc(db, 'correction_requests', reportId);
    const auditLogRef = doc(collection(db, 'report_audit_logs'));

    const auditLog = {
      requestId: reportId,
      employeeId: employeeId.trim().toUpperCase(),
      employeeName: requestData.employeeName,
      originalReport,
      correctedReport,
      adminUserId: requestData.adminUserId || '',
      approvalTime: requestData.approvedAt || null,
      correctionTime: Timestamp.now(),
      reason: requestData.reason
    };

    const batch = writeBatch(db);
    batch.set(reportRef, correctedReport);
    batch.update(requestRef, { 
      status: 'Completed',
      completedAt: Timestamp.now()
    });
    batch.set(auditLogRef, auditLog);

    await batch.commit();
    return correctedReport;
  }
};
