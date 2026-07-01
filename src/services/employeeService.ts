import { deleteApp } from 'firebase/app';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth';
import { db, createSecondaryAuth } from '../firebase/config';
import type { Employee } from '../types';

export const employeeService = {
  /**
   * Creates a new employee using secondary Auth app so that the admin is not signed out.
   */
  async createEmployee(data: {
    employeeId: string;
    name: string;
    phone: string;
    shiftRate: number;
    password: string;
  }, adminUid: string) {
    const employeeId = data.employeeId.trim().toUpperCase();
    const email = `${employeeId}@shiftmp.local`;

    // 1. Verify employeeId doesn't already exist in firestore
    const employeeQuery = query(collection(db, 'employees'), where('employeeId', '==', employeeId));
    const querySnapshot = await getDocs(employeeQuery);
    
    // We should search active/disabled employees
    const activeExists = querySnapshot.docs.some(doc => doc.data().status !== 'deleted');
    if (activeExists) {
      throw new Error(`Employee ID "${employeeId}" already exists and is active/disabled.`);
    }

    // 2. Create in Auth using secondary App instance
    const { secondaryApp, secondaryAuth } = createSecondaryAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, data.password);
      const user = userCredential.user;

      // Create Employee object
      const newEmployee: Employee = {
        uid: user.uid,
        employeeId: employeeId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        shiftRate: Number(data.shiftRate),
        role: 'employee',
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: adminUid
      };

      // 3. Save to Firestore (upsert, in case a deleted employee document is overwritten)
      await setDoc(doc(db, 'employees', user.uid), newEmployee);

      // Sign out from secondary app to clean up session
      await signOut(secondaryAuth);
      return newEmployee;
    } finally {
      // Delete the secondary app instance
      await deleteApp(secondaryApp);
    }
  },

  /**
   * Get an employee by UID
   */
  async getEmployeeByUid(uid: string): Promise<Employee | null> {
    const docRef = doc(db, 'employees', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as Employee) };
    }
    return null;
  },

  /**
   * Get an employee by Employee ID (e.g. EMP001)
   */
  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    const q = query(
      collection(db, 'employees'), 
      where('employeeId', '==', employeeId.trim().toUpperCase())
    );
    const querySnapshot = await getDocs(q);
    
    // Return the first non-deleted employee matching ID
    const foundDoc = querySnapshot.docs.find(d => d.data().status !== 'deleted');
    if (foundDoc) {
      return { id: foundDoc.id, ...(foundDoc.data() as Employee) };
    }
    return null;
  },

  /**
   * Update an employee's profile
   */
  async updateEmployee(uid: string, data: Partial<Omit<Employee, 'uid' | 'employeeId' | 'role' | 'createdAt' | 'createdBy'>>) {
    const docRef = doc(db, 'employees', uid);
    await updateDoc(docRef, data);
  },

  /**
   * Disable an employee (update status in Firestore)
   */
  async disableEmployee(uid: string) {
    const docRef = doc(db, 'employees', uid);
    await updateDoc(docRef, { status: 'disabled' });
  },

  /**
   * Enable an employee
   */
  async enableEmployee(uid: string) {
    const docRef = doc(db, 'employees', uid);
    await updateDoc(docRef, { status: 'active' });
  },

  /**
   * Delete an employee (Delete Firestore document)
   */
  async deleteEmployee(id: string) {
    const docRef = doc(db, 'employees', id);
    await deleteDoc(docRef);
  },

  /**
   * Reset Password for an Employee using their current credentials (client-side limitation)
   */
  async resetEmployeePassword(employeeId: string, currentPassword: string, newPassword: string) {
    const email = `${employeeId.trim().toUpperCase()}@shiftmp.local`;
    const { secondaryApp, secondaryAuth } = createSecondaryAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
      const user = userCredential.user;
      await updatePassword(user, newPassword);
      await signOut(secondaryAuth);
      return true;
    } finally {
      await deleteApp(secondaryApp);
    }
  },

  /**
   * List all non-deleted employees in real-time
   */
  subscribeToEmployees(callback: (employees: Employee[]) => void) {
    const q = query(
      collection(db, 'employees'), 
      orderBy('employeeId')
    );
    return onSnapshot(q, (snapshot) => {
      const employees: Employee[] = [];
      snapshot.forEach((doc) => {
        const emp = { id: doc.id, ...(doc.data() as Employee) };
        if (emp.status !== 'deleted' && emp.role !== 'admin') {
          employees.push(emp);
        }
      });
      callback(employees);
    }, (error) => {
      console.error("Subscription to employees failed: ", error);
    });
  },

  /**
   * Get all active employees (one-off)
   */
  async getActiveEmployees(): Promise<Employee[]> {
    const q = query(
      collection(db, 'employees'),
      where('status', '==', 'active'),
      where('role', '==', 'employee')
    );
    const snapshot = await getDocs(q);
    const employees: Employee[] = [];
    snapshot.forEach((doc) => {
      employees.push({ id: doc.id, ...(doc.data() as Employee) });
    });
    return employees;
  }
};
