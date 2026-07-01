import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Attendance, AdminManualAttendance } from '../types';

export const attendanceService = {
  /**
   * Get unique document ID for attendance
   */
  getDocId(employeeId: string, date: string): string {
    return `${employeeId.trim().toUpperCase()}_${date}`;
  },

  /**
   * Mark morning attendance for an employee (Portal Submission)
   */
  async markAttendance(employeeId: string, date: string, timeIn: string, status: 'Present' | 'Absent' = 'Present') {
    const docId = this.getDocId(employeeId, date);
    
    // Check if already exists in employee_attendance
    const docRef = doc(db, 'employee_attendance', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      throw new Error(`Attendance already marked for today (${date}) in Portal.`);
    }

    const attendance = {
      employeeId: employeeId.trim().toUpperCase(),
      date,
      timeIn,
      status,
      createdAt: Timestamp.now(),
      submittedBy: 'employee',
      entryType: 'portal'
    };

    await setDoc(docRef, attendance);
    return attendance;
  },

  /**
   * Save or Update Admin Manual Attendance override
   */
  async saveAdminManualAttendance(data: {
    employeeId: string;
    employeeName: string;
    date: string;
    attendanceStatus: 'Present' | 'Absent';
    timeIn: string;
    timeOut: string;
    adminUserId: string;
  }) {
    const docId = this.getDocId(data.employeeId, data.date);
    const docRef = doc(db, 'admin_manual_attendance', docId);
    
    const docSnap = await getDoc(docRef);
    const now = Timestamp.now();
    const createdAt = docSnap.exists() ? docSnap.data().createdAt : now;

    const manualRecord: AdminManualAttendance = {
      employeeId: data.employeeId.trim().toUpperCase(),
      employeeName: data.employeeName,
      date: data.date,
      attendanceStatus: data.attendanceStatus,
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      submittedBy: 'admin',
      entryType: 'manual',
      createdAt,
      updatedAt: now,
      adminUserId: data.adminUserId
    };

    await setDoc(docRef, manualRecord);
    return manualRecord;
  },

  /**
   * Check if employee portal attendance has been marked
   */
  async getEmployeeAttendanceForDate(employeeId: string, date: string): Promise<Attendance | null> {
    const docId = this.getDocId(employeeId, date);
    const docSnap = await getDoc(doc(db, 'employee_attendance', docId));
    if (docSnap.exists()) {
      return docSnap.data() as Attendance;
    }
    return null;
  },

  /**
   * Check if admin manual attendance has been marked
   */
  async getAdminManualAttendanceForDate(employeeId: string, date: string): Promise<AdminManualAttendance | null> {
    const docId = this.getDocId(employeeId, date);
    const docSnap = await getDoc(doc(db, 'admin_manual_attendance', docId));
    if (docSnap.exists()) {
      return docSnap.data() as AdminManualAttendance;
    }
    return null;
  },

  /**
   * Subscribe to all attendance records (merged) for a specific date (real-time)
   */
  subscribeToDateAttendance(date: string, callback: (attendances: Attendance[]) => void) {
    let empAtts: Attendance[] = [];
    let adminAtts: Attendance[] = [];

    const notify = () => {
      const merged = [...empAtts];
      // Override or append admin logs
      adminAtts.forEach(adminLog => {
        const existingIdx = merged.findIndex(m => m.employeeId === adminLog.employeeId);
        if (existingIdx !== -1) {
          merged.push(adminLog);
        } else {
          merged.push(adminLog);
        }
      });
      callback(merged);
    };

    const qEmp = query(collection(db, 'employee_attendance'), where('date', '==', date));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      empAtts = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        empAtts.push({
          id: docSnap.id,
          employeeId: data.employeeId,
          date: data.date,
          timeIn: data.timeIn,
          status: data.status,
          createdAt: data.createdAt,
          submittedBy: 'employee',
          entryType: 'portal'
        });
      });
      notify();
    });

    const qAdmin = query(collection(db, 'admin_manual_attendance'), where('date', '==', date));
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      adminAtts = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        adminAtts.push({
          id: docSnap.id,
          employeeId: data.employeeId,
          date: data.date,
          timeIn: data.timeIn,
          status: data.attendanceStatus,
          createdAt: data.createdAt,
          submittedBy: 'admin',
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
   * Subscribe to employee's own portal attendance records (Sorted client-side to avoid composite indexes)
   */
  subscribeToEmployeeAttendance(
    employeeId: string, 
    callback: (attendances: Attendance[]) => void,
    errorCallback?: (error: any) => void
  ) {
    const q = query(
      collection(db, 'employee_attendance'),
      where('employeeId', '==', employeeId.trim().toUpperCase())
    );
    return onSnapshot(q, (snapshot) => {
      const attendances: Attendance[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        attendances.push({
          id: docSnap.id,
          employeeId: data.employeeId,
          date: data.date,
          timeIn: data.timeIn,
          status: data.status,
          createdAt: data.createdAt,
          submittedBy: 'employee',
          entryType: 'portal'
        });
      });
      // Sort in-memory descending
      attendances.sort((a, b) => b.date.localeCompare(a.date));
      callback(attendances);
    }, (error) => {
      console.error("Failed to subscribe to employee attendance:", error);
      if (errorCallback) errorCallback(error);
    });
  },

  /**
   * Subscribe to all admin manual attendance records for audit review (Sorted client-side to avoid index requirements)
   */
  subscribeToAdminManualAttendance(
    employeeId?: string, 
    callback?: (records: AdminManualAttendance[]) => void,
    errorCallback?: (error: any) => void
  ) {
    const collRef = collection(db, 'admin_manual_attendance');
    const q = employeeId 
      ? query(collRef, where('employeeId', '==', employeeId.trim().toUpperCase()))
      : query(collRef);

    return onSnapshot(q, (snapshot) => {
      const records: AdminManualAttendance[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ id: docSnap.id, ...docSnap.data() } as AdminManualAttendance);
      });
      // Sort in-memory descending
      records.sort((a, b) => b.date.localeCompare(a.date));
      if (callback) callback(records);
    }, (error) => {
      console.error("Failed to subscribe to admin manual attendance:", error);
      if (errorCallback) errorCallback(error);
    });
  },

  /**
   * Fetch attendance within a date range (filterable by source)
   */
  async getAttendanceInRange(
    startDate: string, 
    endDate: string, 
    source: 'employee' | 'admin' | 'combined' = 'combined'
  ): Promise<Attendance[]> {
    const results: Attendance[] = [];

    if (source === 'employee' || source === 'combined') {
      const qEmp = query(
        collection(db, 'employee_attendance'),
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
          timeIn: data.timeIn,
          status: data.status,
          createdAt: data.createdAt,
          submittedBy: 'employee',
          entryType: 'portal'
        });
      });
    }

    if (source === 'admin' || source === 'combined') {
      const qAdmin = query(
        collection(db, 'admin_manual_attendance'),
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
          timeIn: data.timeIn,
          status: data.attendanceStatus,
          createdAt: data.createdAt,
          submittedBy: 'admin',
          entryType: 'manual'
        });
      });
    }

    // Sort descending by date
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }
};
