import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  User, 
  LogOut, 
  Menu, 
  X,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export const EmployeeLayout: React.FC = () => {
  const { logout, profile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
    }
  };

  const navItems = [
    { to: '/dashboard', name: t('dashboard'), icon: LayoutDashboard },
    { to: '/my-reports', name: t('my_reports'), icon: FileSpreadsheet },
    { to: '/profile', name: t('profile'), icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand/Logo */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <UserCheck size={20} />
            </div>
            <span className="font-bold text-lg text-slate-800 tracking-tight">{t('brand_name')}</span>
          </Link>
          <button 
            className="lg:hidden p-1 text-slate-500 hover:bg-slate-50 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Employee Identity & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="h-9 w-9 bg-blue-100 text-blue-600 flex items-center justify-center rounded-xl font-bold uppercase">
              {profile?.name ? profile.name.slice(0, 2) : 'EM'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.name || 'Employee'}</p>
              <p className="text-xs text-slate-400 font-mono truncate">{profile?.employeeId || 'ID'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-sm font-semibold transition cursor-pointer"
          >
            <LogOut size={16} />
            <span>{t('sign_out')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 lg:block hidden">{t('employee_portal')}</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/60 rounded-xl p-1 text-xs font-bold text-slate-655 shadow-xs">
              <span className="pl-1.5 text-slate-500">🌐</span>
              <button 
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${language === 'en' ? 'bg-blue-600 text-white font-extrabold shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                English
              </button>
              <span className="text-slate-200">|</span>
              <button 
                onClick={() => setLanguage('ta')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${language === 'ta' ? 'bg-blue-600 text-white font-extrabold shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                தமிழ்
              </button>
            </div>

            <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
              {t('active_session')}
            </span>
          </div>
        </header>

        {/* Main page content container */}
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
