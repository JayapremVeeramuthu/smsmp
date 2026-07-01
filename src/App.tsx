import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { LanguageProvider } from './contexts/LanguageContext';
import { InstallPrompt } from './components/common/InstallPrompt';
import { OfflineBanner } from './components/common/OfflineBanner';

// Layouts
import { AdminLayout } from './components/layouts/AdminLayout';
import { EmployeeLayout } from './components/layouts/EmployeeLayout';

// Auth Pages
import { AdminLogin } from './pages/auth/AdminLogin';
import { EmployeeLogin } from './pages/auth/EmployeeLogin';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { Employees } from './pages/admin/Employees';
import { EmployeeDetails } from './pages/admin/EmployeeDetails';
import { ManualEntry } from './pages/admin/ManualEntry';
import { Reports } from './pages/admin/Reports';
import { CorrectionRequests } from './pages/admin/CorrectionRequests';

// Employee Pages
import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MyReports } from './pages/employee/MyReports';
import { Profile } from './pages/employee/Profile';

// Route Guard for Role Authorization
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'admin' | 'employee';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
        <p className="text-sm font-semibold text-slate-500 font-medium">Verifying authorization...</p>
      </div>
    );
  }

  if (!user || !profile) {
    const redirectPath = allowedRole === 'admin' ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  if (profile.role !== allowedRole) {
    const redirectPath = profile.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

// Automatic Home Redirect based on current auth state
const HomeRedirect: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (user && profile) {
    return profile.role === 'admin' 
      ? <Navigate to="/admin/dashboard" replace /> 
      : <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <OfflineBanner />
          <InstallPrompt />
          <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<EmployeeLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin Protected Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employee/:uid" element={<EmployeeDetails />} />
              <Route path="manual-entry" element={<ManualEntry />} />
              <Route path="reports" element={<Reports />} />
              <Route path="correction-requests" element={<CorrectionRequests />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Employee Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute allowedRole="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="my-reports" element={<MyReports />} />
              <Route path="profile" element={<Profile />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Fallbacks */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1e293b',
              fontWeight: 650,
              fontSize: '14px',
              borderRadius: '12px',
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
            }
          }}
        />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
