import { useState } from 'react';
import api from '../api';

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateStaffModal({ isOpen, onClose, onSuccess }: CreateStaffModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('guard');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/users/', {
        email,
        password,
        role
      });
      
      setEmail('');
      setPassword('');
      setRole('guard');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося створити працівника"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
        <div className="flex justify-between items-center mb-5 border-b pb-3">
          <h3 className="text-xl font-bold text-slate-800">Новий співробітник</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email (Логін) *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="guard@example.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Пароль *</label>
            <input type="text" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Мінімум 6 символів"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Посада (Роль) *</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500">
              <option value="guard">Екіпаж (Охоронець)</option>
              <option value="dispatcher">Диспетчер</option>
              <option value="admin">Адміністратор</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50 font-medium transition">Скасувати</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 font-medium shadow-sm transition">
              {loading ? 'Створення...' : 'Створити акаунт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}