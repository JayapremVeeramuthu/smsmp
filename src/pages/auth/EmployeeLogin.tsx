import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, User, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const EmployeeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  // If already logged in, redirect
  React.useEffect(() => {
    if (profile?.role === 'employee') {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await authService.loginEmployee(data.employeeId, data.password);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check ID and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex bg-indigo-600 text-white p-3 rounded-2xl shadow-sm mb-4">
          <UserCheck size={32} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">MP Employee CMS</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Employee Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-100 rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Employee ID Field */}
            <div>
              <label className="block text-sm font-bold text-slate-700">Employee ID</label>
              <div className="mt-1.5 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="EMP001"
                  className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                    errors.employeeId ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-xl bg-slate-50/50 placeholder-slate-400 focus:outline-hidden focus:ring-2`}
                  {...register('employeeId', { 
                    required: 'Employee ID is required',
                    pattern: {
                      value: /^EMP\d+$/i,
                      message: 'Employee ID must be in format EMP001'
                    }
                  })}
                />
              </div>
              {errors.employeeId && (
                <p className="mt-1 text-xs text-red-600 font-semibold">{errors.employeeId.message as string}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-bold text-slate-700">Password</label>
              <div className="mt-1.5 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                    errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-xl bg-slate-50/50 placeholder-slate-400 focus:outline-hidden focus:ring-2`}
                  {...register('password', { required: 'Password is required' })}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 font-semibold">{errors.password.message as string}</p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Quick link to admin portal */}
          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <Link to="/admin/login" className="text-sm font-semibold text-slate-500 hover:text-slate-700">
              Are you an Admin? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EmployeeLogin;
