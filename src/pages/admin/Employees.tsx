import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  UserX, 
  UserCheck, 
  Trash2, 
  KeyRound, 
  Phone, 
  IndianRupee, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Loader2 
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const Employees: React.FC = () => {
  const { user } = useAuth();
  
  // States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form Hooks
  const createForm = useForm();
  const editForm = useForm();
  const resetForm = useForm();

  // Load Employees Subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = employeeService.subscribeToEmployees((data) => {
      setEmployees(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter & Search Logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      emp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Create Employee Submit
  const onCreateSubmit = async (data: any) => {
    if (!user) return;
    try {
      await employeeService.createEmployee({
        employeeId: data.employeeId,
        name: data.name,
        phone: data.phone,
        shiftRate: Number(data.shiftRate),
        password: data.password
      }, user.uid);
      
      toast.success(`Employee ${data.name} created successfully!`);
      createForm.reset();
      setCreateModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create employee');
    }
  };

  // Edit Employee Submit
  const onEditSubmit = async (data: any) => {
    if (!selectedEmployee) return;
    try {
      await employeeService.updateEmployee(selectedEmployee.uid, {
        name: data.name,
        phone: data.phone,
        shiftRate: Number(data.shiftRate)
      });
      
      toast.success('Employee profile updated successfully!');
      setEditModalOpen(false);
      setSelectedEmployee(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update employee');
    }
  };

  // Password Reset Submit
  const onResetSubmit = async (data: any) => {
    if (!selectedEmployee) return;
    try {
      await employeeService.resetEmployeePassword(
        selectedEmployee.employeeId,
        data.oldPassword,
        data.newPassword
      );
      toast.success('Password updated successfully!');
      resetForm.reset();
      setResetPwdModalOpen(false);
      setSelectedEmployee(null);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed. Make sure current password is correct.');
    }
  };

  // Toggle Employee Status
  const handleToggleStatus = async (emp: Employee) => {
    try {
      if (emp.status === 'active') {
        await employeeService.disableEmployee(emp.uid);
        toast.success(`Employee ${emp.name} is now disabled.`);
      } else {
        await employeeService.enableEmployee(emp.uid);
        toast.success(`Employee ${emp.name} is now active.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Status toggle failed.');
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (emp: Employee | undefined | null) => {
    // 3. Ensure the selected employee object always exists before deletion.
    if (!emp) {
      toast.error("Employee not found.");
      return;
    }

    // 4. Before deleting: Verify ID is present
    if (!emp.id) {
      toast.error("Employee UID is missing.");
      return;
    }

    // Verify fields:
    // - employee.id
    // - employee.employeeId
    // - employee.name
    // - employee.role
    // - employee.permissions
    const empId = emp.id;
    const employeeId = emp.employeeId;
    const name = emp.name;
    const role = emp.role;
    const permissions = (emp as any).permissions;

    // 2. Check every variable before calling indexOf()
    const safeId = empId !== undefined ? empId : '';
    const safeEmployeeId = employeeId !== undefined ? employeeId : '';
    const safeName = name !== undefined ? name : '';
    const safeRole = role !== undefined ? role : '';
    const safePermissions = permissions !== undefined ? permissions : [];

    const traceIndexOf = (val: any, term: string) => {
      if (typeof val === 'string') {
        return val?.indexOf(term) ?? -1;
      }
      if (Array.isArray(val)) {
        return val.indexOf(term);
      }
      return -1;
    };

    traceIndexOf(safeId, 'test');
    traceIndexOf(safeEmployeeId, 'test');
    traceIndexOf(safeName, 'test');
    traceIndexOf(safeRole, 'test');
    traceIndexOf(safePermissions, 'test');

    // 5. Delete process:
    // - Show confirmation dialog.
    const confirmed = window.confirm(`Are you sure you want to delete employee ${safeName || 'Unknown'}? This will delete the employee document.`);
    if (!confirmed) return;

    try {
      // - Delete Firestore document.
      await employeeService.deleteEmployee(emp.id);

      // - Refresh employee list.
      // Real-time subscription in useEffect takes care of refreshing the list automatically.

      // - Show success toast.
      toast.success(`Employee ${safeName || 'Unknown'} deleted successfully.`);
    } catch (err: any) {
      // 6. If Firestore deletion fails: Show proper error message. Never crash the UI.
      toast.error(err.message || 'Failed to delete employee document.');
    }
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    editForm.reset({
      name: emp.name,
      phone: emp.phone,
      shiftRate: emp.shiftRate
    });
    setEditModalOpen(true);
  };

  const openResetModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    resetForm.reset({
      oldPassword: '',
      newPassword: ''
    });
    setResetPwdModalOpen(true);
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600 mb-3" size={40} />
        <p className="text-sm font-semibold text-slate-500">Loading employees list...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Employee Directory</h2>
          <p className="text-sm text-slate-400 font-medium">Add, manage, and monitor employee access and rates.</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by Employee ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="text-slate-400 p-2"><Filter size={16} /></div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2 pl-3 pr-8 border border-slate-200 bg-slate-50/50 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-550 text-slate-650"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-55/30">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee ID</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Shift Rate</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
                    No employees matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-55/20">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/admin/employee/${emp.uid}`} className="block">
                        <div className="text-sm font-bold text-slate-800 hover:text-blue-600 transition">{emp.name}</div>
                        <div className="text-xs text-slate-400 font-mono font-semibold">role: {emp.role}</div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600 font-mono">
                      {emp.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-500">
                      {emp.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                      ₹{emp.shiftRate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full border ${
                        emp.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold space-x-1.5">
                      <button
                        onClick={() => openEditModal(emp)}
                        title="Edit profile"
                        className="inline-flex p-1.5 bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 rounded-lg text-slate-500 transition cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        title={emp.status === 'active' ? 'Disable account' : 'Enable account'}
                        className={`inline-flex p-1.5 bg-slate-50 border border-slate-100 rounded-lg transition cursor-pointer ${
                          emp.status === 'active' 
                            ? 'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 text-slate-500' 
                            : 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 text-slate-500'
                        }`}
                      >
                        {emp.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        onClick={() => openResetModal(emp)}
                        title="Change password"
                        className="inline-flex p-1.5 bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 rounded-lg text-slate-500 transition cursor-pointer"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        title="Delete account"
                        className="inline-flex p-1.5 bg-slate-50 border border-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-lg text-slate-500 transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-55 border border-slate-100 text-slate-650 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 rounded-lg transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-55 border border-slate-100 text-slate-650 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 rounded-lg transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE EMPLOYEE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add New Employee</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:bg-slate-55 rounded-lg p-1.5"><X size={18} /></button>
            </div>
            
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="p-6 space-y-4 text-left">
              {/* Employee ID */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee ID</label>
                <input
                  type="text"
                  placeholder="EMP001"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...createForm.register('employeeId', { 
                    required: 'Employee ID is required',
                    pattern: {
                      value: /^EMP\d+$/i,
                      message: 'Must be in EMP001 format'
                    }
                  })}
                />
                {createForm.formState.errors.employeeId && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{createForm.formState.errors.employeeId.message as string}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Prem Kumar"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...createForm.register('name', { required: 'Name is required' })}
                />
                {createForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{createForm.formState.errors.name.message as string}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...createForm.register('password', { 
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' }
                  })}
                />
                {createForm.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{createForm.formState.errors.password.message as string}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Phone size={15} /></div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    className="block w-full pl-9 border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    {...createForm.register('phone', { required: 'Phone number is required' })}
                  />
                </div>
                {createForm.formState.errors.phone && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{createForm.formState.errors.phone.message as string}</p>
                )}
              </div>

              {/* Shift Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift Rate (₹ / Shift)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-450"><IndianRupee size={15} /></div>
                  <input
                    type="number"
                    placeholder="400"
                    className="block w-full pl-9 border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    {...createForm.register('shiftRate', { 
                      required: 'Shift rate is required',
                      min: { value: 0, message: 'Must be greater than 0' }
                    })}
                  />
                </div>
                {createForm.formState.errors.shiftRate && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{createForm.formState.errors.shiftRate.message as string}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-750 transition"
              >
                Create Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE PROFILE MODAL */}
      {editModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit Employee Details</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:bg-slate-55 rounded-lg p-1.5"><X size={18} /></button>
            </div>
            
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="p-6 space-y-4 text-left">
              {/* ID (Read-only) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Employee ID (Locked)</label>
                <input
                  type="text"
                  disabled
                  value={selectedEmployee.employeeId}
                  className="block w-full border border-slate-100 bg-slate-50 text-slate-400 rounded-xl py-2 px-3 text-sm font-semibold cursor-not-allowed font-mono"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Prem Kumar"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...editForm.register('name', { required: 'Name is required' })}
                />
                {editForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{editForm.formState.errors.name.message as string}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Phone size={15} /></div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    className="block w-full pl-9 border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    {...editForm.register('phone', { required: 'Phone number is required' })}
                  />
                </div>
                {editForm.formState.errors.phone && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{editForm.formState.errors.phone.message as string}</p>
                )}
              </div>

              {/* Shift Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift Rate (₹ / Shift)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-450"><IndianRupee size={15} /></div>
                  <input
                    type="number"
                    placeholder="400"
                    className="block w-full pl-9 border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    {...editForm.register('shiftRate', { 
                      required: 'Shift rate is required',
                      min: { value: 0, message: 'Must be greater than 0' }
                    })}
                  />
                </div>
                {editForm.formState.errors.shiftRate && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{editForm.formState.errors.shiftRate.message as string}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-750 transition"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {resetPwdModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 text-left">Reset Password</h3>
              <button onClick={() => setResetPwdModalOpen(false)} className="text-slate-400 hover:bg-slate-55 rounded-lg p-1.5"><X size={18} /></button>
            </div>
            
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="p-6 space-y-4 text-left">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800 space-y-1.5 font-semibold">
                <p className="font-bold">Firebase Authentication policy limit:</p>
                <p>To reset this password client-side, please provide the employee's current password. If they forgot it, resets must be done by the Administrator in the **Firebase Console** (search for {selectedEmployee.employeeId.toLowerCase()}@shiftmp.local).</p>
              </div>

              {/* ID */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Employee ID</label>
                <input
                  type="text"
                  disabled
                  value={selectedEmployee.employeeId}
                  className="block w-full border border-slate-100 bg-slate-50 text-slate-400 rounded-xl py-2 px-3 text-sm font-semibold font-mono"
                />
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...resetForm.register('oldPassword', { required: 'Current password is required' })}
                />
                {resetForm.formState.errors.oldPassword && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{resetForm.formState.errors.oldPassword.message as string}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="block w-full border border-slate-200 bg-slate-50/50 rounded-xl py-2 px-3 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                  {...resetForm.register('newPassword', { 
                    required: 'New password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' }
                  })}
                />
                {resetForm.formState.errors.newPassword && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{resetForm.formState.errors.newPassword.message as string}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-750 transition"
              >
                Change Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Employees;
