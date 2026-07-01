import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { employeeService } from '../../services/employeeService';
import { useForm } from 'react-hook-form';
import { Phone, KeyRound, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile: React.FC = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [savingPhone, setSavingPhone] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const phoneForm = useForm({
    defaultValues: {
      phone: profile?.phone || ''
    }
  });

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const onPhoneSubmit = async (data: { phone: string }) => {
    if (!profile) return;
    setSavingPhone(true);
    try {
      await employeeService.updateEmployee(profile.uid, {
        name: profile.name,
        phone: data.phone
      });
      toast.success(t('phone_update_success'));
    } catch (err: any) {
      toast.error(err.message || t('phone_update_failed'));
    } finally {
      setSavingPhone(false);
    }
  };

  const onPasswordSubmit = async (data: any) => {
    if (!profile) return;
    if (data.newPassword !== data.confirmPassword) {
      toast.error(t('passwords_dont_match'));
      return;
    }
    setChangingPassword(true);
    try {
      await employeeService.resetEmployeePassword(
        profile.employeeId,
        data.currentPassword,
        data.newPassword
      );
      toast.success(t('password_change_success'));
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      toast.error(err.message || t('password_change_failed'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-left">
        <h2 className="text-2xl font-bold text-slate-800">{t('my_profile')}</h2>
        <p className="text-sm text-slate-400 font-medium">{t('profile_description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Info card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider text-left">{t('account_details')}</h3>
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl font-bold text-lg">
              {profile.name.charAt(0)}
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-slate-800">{profile.name}</p>
              <p className="text-xs text-slate-450 font-mono font-semibold uppercase">{profile.employeeId}</p>
            </div>
          </div>

          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="border-t border-slate-50 pt-4 space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('phone_number')}</label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone size={15} />
                </div>
                <input
                  type="tel"
                  placeholder="9876543210"
                  className="block w-full pl-9 py-2 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...phoneForm.register('phone', { required: t('phone_required') })}
                />
              </div>
              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-650 font-semibold">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingPhone}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {savingPhone ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              <span>{t('save_phone')}</span>
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2 text-left">
            <KeyRound size={16} className="text-slate-400" />
            <span>{t('update_password')}</span>
          </h3>

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 text-left">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-slate-550 uppercase mb-1">{t('current_password')}</label>
              <input
                type="password"
                placeholder="••••••••"
                className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                {...passwordForm.register('currentPassword', { required: t('password_required') })}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="mt-1 text-xs text-red-650 font-semibold">{passwordForm.formState.errors.currentPassword.message as string}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-550 uppercase mb-1">{t('new_password')}</label>
              <input
                type="password"
                placeholder="••••••••"
                className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                {...passwordForm.register('newPassword', { 
                  required: t('password_required'),
                  minLength: { value: 6, message: t('password_min_length') }
                })}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="mt-1 text-xs text-red-650 font-semibold">{passwordForm.formState.errors.newPassword.message as string}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-550 uppercase mb-1">{t('confirm_new_password')}</label>
              <input
                type="password"
                placeholder="••••••••"
                className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                {...passwordForm.register('confirmPassword', { required: t('password_required') })}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-650 font-semibold">{passwordForm.formState.errors.confirmPassword.message as string}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {changingPassword ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />}
              <span>{t('change_password')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Profile;
