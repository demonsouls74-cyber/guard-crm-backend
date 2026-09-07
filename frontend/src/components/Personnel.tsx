import { useState, useEffect } from 'react';
import api from '../api';
import CreateStaffModal from './CreateStaffModal';

interface User {
  id: number;
  email: string;
  role: string;
}

export default function Personnel() {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/');
      // Відфільтровуємо клієнтів, залишаємо тільки персонал
      const staffMembers = response.data.filter((u: User) => u.role !== 'client');
      setStaff(staffMembers);
    } catch (error) {
      console.error('Помилка завантаження персоналу:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-md text-xs font-bold border border-purple-200">Адміністратор</span>;
      case 'dispatcher': return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-bold border border-blue-200">Диспетчер</span>;
      case 'guard': return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-md text-xs font-bold border border-amber-200">Екіпаж реагування</span>;
      default: return <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-md text-xs font-bold border border-slate-200">{role}</span>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Персонал</h1>
          <p className="text-sm text-slate-500 mt-1">Керування робочими акаунтами та рівнями доступу</p>
        </div>
        <div className="space-x-3">
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium">
            + Найняти співробітника
          </button>
          <button onClick={fetchStaff} className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition shadow-sm font-medium">
            ↻ Оновити
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500 font-medium">Завантаження...</div>
        ) : staff.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium">Немає зареєстрованого персоналу.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Робочий Email (Логін)</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Посада</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">#{member.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{member.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(member.role)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateStaffModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchStaff} 
      />
    </div>
  );
}