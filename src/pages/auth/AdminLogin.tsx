import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  // If already logged in as admin, redirect
  React.useEffect(() => {
    if (profile?.role === 'admin') {
      navigate('/admin/dashboard');
    }
  }, [profile, navigate]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await authService.loginAdmin(data.email, data.password);
      toast.success('Logged in as administrator');
      navigate('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex bg-blue-600 text-white p-3 rounded-2xl shadow-sm mb-4">
          <UserCheck size={32} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">MP Employee CMS</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Admin Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-100 rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label className="block text-sm font-bold text-slate-700">Email address</label>
              <div className="mt-1.5 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="admin@company.com"
                  className={`block w-full pl-10 pr-3 py-2 text-sm border ${
                    errors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
                  } rounded-xl bg-slate-50/50 placeholder-slate-400 focus:outline-hidden focus:ring-2`}
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 font-semibold">{errors.email.message as string}</p>
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
                    errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
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
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Quick link to employee portal */}
          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <Link to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
              Are you an Employee? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdminLogin;
