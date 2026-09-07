import { useState, useEffect } from 'react';
import api from '../api';
import LocationPicker from './LocationPicker';

interface User {
  id: number;
  email: string;
  role: string;
  full_name?: string | null;
}

interface CreateObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateObjectModal({ isOpen, onClose, onSuccess }: CreateObjectModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState('');
  const [clientId, setClientId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [monthlyFee, setMonthlyFee] = useState<number | string>(0);
  
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<User[]>([]);

  useEffect(() => {
    if (isOpen) fetchClients();
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      const response = await api.get('/users/');
      const clientList = response.data.filter((user: User) => user.role === 'client');
      setClients(clientList);
      if (clientList.length > 0) setClientId(clientList[0].id.toString());
    } catch (error) {
      console.error('Помилка завантаження клієнтів:', error);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert("Будь ласка, оберіть клієнта зі списку.");
      return;
    }

    setLoading(true);
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (coords.trim()) {
      const parts = coords.split(',').map(item => parseFloat(item.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        latitude = parts[0];
        longitude = parts[1];
      } else {
        alert("Неправильний формат координат!");
        setLoading(false);
        return;
      }
    }

    const payload = {
      name,
      address,
      latitude,
      longitude,
      client_id: parseInt(clientId, 10),
      instructions: instructions || null,
      status,
      monthly_fee: parseFloat(monthlyFee.toString()) || 0
    };

    try {
      await api.post('/objects/', payload);
      setName(''); setAddress(''); setCoords(''); setInstructions(''); 
      setStatus('ACTIVE'); setMonthlyFee(0);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося створити об'єкт"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">Новий об'єкт охорони</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Назва об'єкта</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <LocationPicker address={address} setAddress={setAddress} coords={coords} setCoords={setCoords} />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Власник (Клієнт)</label>
            <select required value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white" >
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.full_name || client.email} (ID: {client.id})
                </option>
              ))}
            </select>
          </div>

          {/* НОВИЙ БЛОК БІЛІНГУ */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Статус об'єкта</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="ACTIVE">Активний</option>
                <option value="SUSPENDED_DEBT">Борг (Відключено)</option>
                <option value="SUSPENDED_CLIENT">Пауза (За запитом)</option>
                <option value="TERMINATED">Розірвано</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Абонплата (₴)</label>
              <input type="number" min="0" step="10" required value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Інструкції для екіпажу</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium">Скасувати</button>
            <button type="submit" disabled={loading || clients.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              {loading ? 'Збереження...' : 'Зберегти об\'єкт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}