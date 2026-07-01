import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { Employee } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: Employee | null;
  loading: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Clean up previous profile subscription
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        setUser(currentUser);
        
        // Listen to employee profile document in Firestore in real-time
        const docRef = doc(db, 'employees', currentUser.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Employee;
            
            // Check status
            if (data.status === 'disabled' || data.status === 'deleted') {
              toast.error('Your account has been disabled or deleted by the administrator.');
              logout();
            } else {
              setProfile(data);
            }
          } else {
            // Fallback: If user exists in Auth but has no document in 'employees',
            // check if email doesn't end with '@shiftmp.local'. If so, treat as admin.
            const isCustomAdmin = currentUser.email && !currentUser.email.endsWith('@shiftmp.local');
            if (isCustomAdmin) {
              setProfile({
                uid: currentUser.uid,
                employeeId: 'ADMIN',
                name: 'Administrator',
                phone: '',
                shiftRate: 0,
                role: 'admin',
                status: 'active',
                createdAt: new Date(),
                createdBy: 'system'
              });
            } else {
              toast.error('Profile not found in database.');
              logout();
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to profile:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isEmployee = profile?.role === 'employee';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isEmployee, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
