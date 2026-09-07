import { useState } from 'react';
import api from '../api';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateClientModal({ isOpen, onClose, onSuccess }: CreateClientModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneMain, setPhoneMain] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [taxId, setTaxId] = useState('');
  const [birthday, setBirthday] = useState('');
  const [referral, setReferral] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // КРОК 1: Створюємо системного користувача (User) з роллю "client"
      const userResponse = await api.post('/users/', {
        email: email,
        password: password,
        role: 'client'
      });

      // Дістаємо ID новоствореного користувача з відповіді бекенда
      const newUserId = userResponse.data.user_id;

      // КРОК 2: Створюємо профіль клієнта (ClientProfile), прив'язаний до цього user_id
      const profilePayload = {
        user_id: newUserId,
        full_name: fullName,
        phone_main: phoneMain,
        phone_alt: phoneAlt || null,
        tax_id: taxId || null,
        birthday: birthday || null,
        referral_source: referral || null,
        contract_status: status
      };

      await api.post('/client-profiles/', profilePayload);

      // Очищуємо форму
      setEmail(''); setPassword(''); setFullName(''); setPhoneMain(''); 
      setPhoneAlt(''); setTaxId(''); setBirthday(''); setReferral(''); setStatus('ACTIVE');
      
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося створити клієнта"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">Новий клієнт (Акаунт + Профіль)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Дані для авторизації */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email (Логін) *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="client@gmail.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Пароль *</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">П.І.Б. *</label>
            <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Шевченко Микола Іванович"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Осн. телефон *</label>
              <input type="text" required value={phoneMain} onChange={e => setPhoneMain(e.target.value)}
                placeholder="0950324565"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Дод. телефон</label>
              <input type="text" value={phoneAlt} onChange={e => setPhoneAlt(e.target.value)}
                placeholder="0945665555"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ІПН / РНОКПП</label>
              <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Дата народження</label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Статус договору</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="ACTIVE">Активний</option>
              <option value="SUSPENDED_BY_CLIENT">Призупинено клієнтом</option>
              <option value="SUSPENDED_BY_ADMIN">Призупинено за борги</option>
              <option value="TERMINATED">Розірвано</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 font-medium">Скасувати</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">
              {loading ? 'Створення...' : 'Створити клієнта'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}