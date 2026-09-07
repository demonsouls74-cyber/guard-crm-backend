import { useState, useEffect } from 'react';
import api from '../api';
import LocationPicker from './LocationPicker';

interface SecurityObject {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  client_id: number;
  client_email: string;
  instructions: string | null;
  status: string;
  monthly_fee: number;
  paid_until: string | null;
}

interface ObjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  object: SecurityObject | null;
}

interface Payment {
  id: number;
  amount: number;
  description: string;
  created_at: string;
}

export default function ObjectDetailsModal({ isOpen, onClose, onSuccess, object }: ObjectDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Створюємо локальну копію об'єкта, щоб миттєво оновлювати UI без закриття модалки
  const [localObject, setLocalObject] = useState<SecurityObject | null>(null);

  // Стейт для форми редагування
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [monthlyFee, setMonthlyFee] = useState<number | string>(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Стейт для оплати
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [isPaying, setIsPaying] = useState(false);

  const fetchPayments = async (objectId: number) => {
    setLoadingPayments(true);
    try {
      const response = await api.get(`/objects/${objectId}/payments/`);
      setPayments(response.data);
    } catch (error) {
      console.error("Помилка завантаження історії оплат", error);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (object && isOpen) {
      setLocalObject(object);
      setName(object.name);
      setAddress(object.address);
      setCoords(object.latitude && object.longitude ? `${object.latitude}, ${object.longitude}` : '');
      setInstructions(object.instructions || '');
      setStatus(object.status);
      setMonthlyFee(object.monthly_fee);
      setPaymentAmount('');
      setIsEditing(false);
      fetchPayments(object.id);
    }
  }, [object, isOpen]);

  if (!isOpen || !localObject) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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

    try {
      await api.put(`/objects/${localObject.id}/`, {
        name,
        address,
        latitude,
        longitude,
        instructions: instructions || null,
        status,
        monthly_fee: parseFloat(monthlyFee.toString()) || 0
      });

      setIsEditing(false);
      onSuccess(); // Оновлює таблицю на фоні
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося оновити об'єкт"}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !localObject) return;

    setIsPaying(true);
    try {
      const response = await api.post(`/objects/${localObject.id}/pay/`, {
        amount: parseFloat(paymentAmount.toString())
      });
      
      setLocalObject({
        ...response.data,
        client_email: localObject.client_email 
      });
      
      setPaymentAmount('');
      fetchPayments(localObject.id); // <--- ОНОВЛЮЄМО ІСТОРІЮ МИТТЄВО
      onSuccess(); 
    } catch (error: any) {
      alert(`Помилка: ${error.response?.data?.detail || "Не вдалося провести оплату"}`);
    } finally {
      setIsPaying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-md text-sm font-bold border border-emerald-200">Активний</span>;
      case 'SUSPENDED_DEBT': return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm font-bold border border-red-200">Борг (Відключено)</span>;
      case 'SUSPENDED_CLIENT': return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-md text-sm font-bold border border-amber-200">Пауза</span>;
      case 'TERMINATED': return <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-md text-sm font-bold border border-slate-200">Розірвано</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      {/* ЗБІЛЬШЕНО ШИРИНУ: max-w-2xl замість max-w-lg */}
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-5 border-b pb-4">
          <h3 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Редагування об\'єкта' : 'Деталі об\'єкта'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none">&times;</button>
        </div>

        {!isEditing ? (
          <div className="space-y-6">
            {/* БЛОК НАЗВИ */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Назва та Адреса</span>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{localObject.name}</p>
                <p className="text-sm text-slate-600 flex items-center mt-1">📍 {localObject.address}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(localObject.status)}
              </div>
            </div>

            {/* БЛОК БІЛІНГУ ТА ВЛАСНИКА (Новий дизайн) */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-2 p-4 gap-4">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Власник</span>
                  <span className="text-sm font-medium text-slate-800 bg-white px-2 py-1 border border-slate-200 rounded">{localObject.client_email}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Тарифний план</span>
                  <span className="text-sm font-bold text-slate-800">{localObject.monthly_fee} ₴ / міс</span>
                </div>
              </div>
              
              {/* Нижня частина блоку - Оплата */}
              <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Оплачено до</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {localObject.paid_until ? new Date(localObject.paid_until).toLocaleDateString('uk-UA', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Немає оплат'}
                  </span>
                </div>

                <form onSubmit={handlePayment} className="flex items-center space-x-2">
                  <input
                    type="number" min="1" step="1" required
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="Сума ₴"
                    className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center shadow-inner"
                  />
                  <button
                    type="submit" disabled={isPaying || !paymentAmount}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg text-sm shadow-sm transition disabled:opacity-50"
                  >
                    {isPaying ? 'Обробка...' : '💳 Оплатити'}
                  </button>
                </form>
              </div>
            </div>

            {/* БЛОК ІНСТРУКЦІЙ */}
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase">Інструкції для екіпажу</span>
              <div className="mt-1 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-slate-800 min-h-[3rem]">
                {localObject.instructions || <span className="text-slate-400 italic">Інструкції відсутні</span>}
              </div>
              {/* НОВИЙ БЛОК: ІСТОРІЯ ОПЛАТ */}
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase">Історія оплат</span>
              <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto custom-scrollbar">
                {loadingPayments ? (
                  <div className="p-4 text-center text-sm text-slate-500">Завантаження...</div>
                ) : payments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500 bg-slate-50">Ще немає жодної транзакції</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Дата</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Сума</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Деталі</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {payments.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                            {new Date(pay.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-emerald-600 whitespace-nowrap">
                            +{pay.amount} ₴
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500">
                            {pay.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50 transition">Закрити</button>
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition">✏️ Редагувати</button>
            </div>
          </div>
        ) : (
          // ================= РЕЖИМ РЕДАГУВАННЯ =================
          <form onSubmit={handleUpdate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Назва об'єкта</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>

            <LocationPicker address={address} setAddress={setAddress} coords={coords} setCoords={setCoords} />

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Статус об'єкта</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="ACTIVE">Активний</option>
                  <option value="SUSPENDED_DEBT">Борг (Відключено)</option>
                  <option value="SUSPENDED_CLIENT">Пауза (За запитом)</option>
                  <option value="TERMINATED">Розірвано</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Абонплата (₴)</label>
                <input type="number" min="0" step="10" required value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Інструкції для екіпажу</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-50 transition">Скасувати зміни</button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition">
                {loading ? 'Збереження...' : '✅ Зберегти'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}