import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

export const authService = {
  /**
   * Admin Login with Email & Password
   */
  async loginAdmin(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  /**
   * Employee Login with Employee ID & Password
   * Translates Employee ID into a fake email under shiftmp.local
   */
  async loginEmployee(employeeId: string, password: string) {
    const formattedId = employeeId.trim().toUpperCase();
    const email = `${formattedId}@shiftmp.local`;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  /**
   * Log out current session
   */
  async logout() {
    await signOut(auth);
  }
};
