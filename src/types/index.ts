import { Timestamp } from 'firebase/firestore';

export interface Employee {
  id?: string;
  uid: string;
  employeeId: string;
  name: string;
  phone: string;
  shiftRate: number;
  role: 'admin' | 'employee';
  status: 'active' | 'disabled' | 'deleted';
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface Attendance {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:MM:SS or HH:MM
  status: 'Present' | 'Absent';
  createdAt: Timestamp | Date;
  submittedBy?: 'employee' | 'admin';
  entryType?: 'portal' | 'manual';
}

export interface DailyReport {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shift: 'S' | 'SI' | 'SII' | 'SIII' | 'SIIII';
  shiftValue: number; // 1, 1.5, 2, 2.5, 3
  advance: number;
  dailyEarnings: number;
  netAmount: number;
  submittedBy: 'employee' | 'admin';
  submittedAt: Timestamp | Date;
  entryType?: 'portal' | 'manual';
}

export interface EmployeeAttendance extends Attendance {
  submittedBy: 'employee';
  entryType: 'portal';
}

export interface EmployeeShiftReport extends DailyReport {
  submittedBy: 'employee';
  entryType: 'portal';
}

export interface AdminManualAttendance {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  attendanceStatus: 'Present' | 'Absent';
  timeIn: string;
  timeOut: string;
  submittedBy: 'admin';
  entryType: 'manual';
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  adminUserId?: string;
}

export interface AdminManualShiftReport {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shift: 'S' | 'SI' | 'SII' | 'SIII' | 'SIIII';
  shiftCount: number;
  overtime: number;
  advance: number;
  remarks: string;
  submittedBy: 'admin';
  entryType: 'manual';
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  adminUserId: string;
  dailyEarnings: number;
  netAmount: number;
}

export type DateFilterType = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}
