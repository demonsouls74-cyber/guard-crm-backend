import { useState, useEffect } from 'react';
import api from '../api';

interface PaymentHistory {
  id: number;
  amount: number;
  description: string;
  created_at: string;
  object_name: string;
  client_name: string;
  client_phone: string;
  processed_by_email: string;
}

export default function Accounting() {
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payments/');
      setPayments(response.data);
    } catch (error) {
      console.error('Помилка завантаження платежів:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Бухоблік</h1>
          <p className="text-sm text-slate-500 mt-1">Загальний реєстр усіх фінансових транзакцій</p>
        </div>
        <div className="flex space-x-3">
          {/* Місце для майбутнього фільтра по датах */}
          <button onClick={fetchPayments} className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition shadow-sm font-medium">
            ↻ Оновити
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500 font-medium">Завантаження реєстру...</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-medium">Ще немає жодної транзакції.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Дата та Час</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Об'єкт</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Клієнт та Контакти</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Сума</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ким прийнято</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-800">
                      {new Date(payment.created_at).toLocaleDateString('uk-UA')}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(payment.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-indigo-900">{payment.object_name}</div>
                    <div className="text-xs text-slate-500">{payment.description}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-700">{payment.client_name}</div>
                    <div className="text-xs text-slate-500">📞 {payment.client_phone}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      +{payment.amount} ₴
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {payment.processed_by_email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}