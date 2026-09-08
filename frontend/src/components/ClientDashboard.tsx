import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

interface Profile {
  full_name: string;
  phone_main: string;
  contract_status: string;
}

interface SecurityObject {
  id: number;
  name: string;
  address: string;
  status: string;
  monthly_fee: number;
  paid_until: string | null;
}

interface Payment {
  id: number;
  amount: number;
  payment_method: string;
  created_at: string;
}

export default function ClientDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [objects, setObjects] = useState<SecurityObject[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Стан для модалки підтвердження тривоги
  const [confirmAlarmObjId, setConfirmAlarmObjId] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, objectsRes, paymentsRes] = await Promise.all([
          api.get('/my/profile/'),
          api.get('/my/objects/'),
          api.get('/my/payments/')
        ]);
        setProfile(profileRes.data);
        setObjects(objectsRes.data);
        setPayments(paymentsRes.data);
      } catch (error) {
        console.error("Помилка завантаження даних клієнта", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const triggerAlarm = async (objectId: number) => {
    try {
      await api.post('/incidents/', { object_id: objectId });
      alert("🚨 ТРИВОГА АКТИВОВАНА! Сигнал передано диспетчеру.");
      setConfirmAlarmObjId(null);
    } catch (error) {
      alert("Помилка при активації тривоги. Негайно телефонуйте диспетчеру!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Завантаження...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* HEADER */}
      <div className="bg-slate-900 text-white p-6 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-blue-400">ОСОБИСТИЙ КАБІНЕТ</h1>
            <p className="text-sm text-slate-400 mt-1">{profile?.full_name || 'Клієнт'}</p>
          </div>
          <button onClick={handleLogout} className="bg-slate-800 hover:bg-red-500 text-white px-4 py-2 rounded transition">
            Вийти
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-8 px-4 space-y-8">
        
        {/* ІНФОРМАЦІЯ ПРО ПРОФІЛЬ */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase mb-1">Контактні дані</h2>
            <p className="text-lg font-medium text-slate-800">{profile?.phone_main}</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-slate-400 uppercase mb-1">Статус договору</h2>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-bold">
              {profile?.contract_status || 'АКТИВНИЙ'}
            </span>
          </div>
        </div>

        {/* ОБ'ЄКТИ ОХОРОНИ ТА ТРИВОЖНІ КНОПКИ */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Мої об'єкти ({objects.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {objects.map(obj => {
              const isPaid = obj.paid_until && new Date(obj.paid_until) > new Date();
              
              return (
                <div key={obj.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{obj.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">📍 {obj.address}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${obj.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                        {obj.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg mb-6 border border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Оплачено до:</span>
                      <span className={`text-sm font-bold ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>
                        {obj.paid_until ? new Date(obj.paid_until).toLocaleDateString('uk-UA') : 'Немає даних'}
                      </span>
                    </div>

                    {/* SOS BUTTON */}
                    {confirmAlarmObjId === obj.id ? (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center animate-pulse">
                        <p className="text-red-800 font-bold mb-3">Викликати екіпаж на цей об'єкт?</p>
                        <div className="flex space-x-3">
                          <button onClick={() => setConfirmAlarmObjId(null)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50">Скасувати</button>
                          <button onClick={() => triggerAlarm(obj.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-black tracking-widest shadow-lg hover:bg-red-700">ПІДТВЕРДИТИ</button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmAlarmObjId(obj.id)}
                        disabled={obj.status !== 'ACTIVE'}
                        className="w-full bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-xl shadow-[0_4px_15px_rgba(220,38,38,0.4)] hover:bg-red-700 hover:shadow-[0_6px_20px_rgba(220,38,38,0.6)] active:scale-95 transition-all"
                      >
                        🚨 ВИКЛИКАТИ ОХОРОНУ
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ІСТОРІЯ ПЛАТЕЖІВ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">Історія платежів</h2>
          </div>
          {payments.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Платежів ще не було.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Дата</th>
                  <th className="px-6 py-3">Сума</th>
                  <th className="px-6 py-3">Метод</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600">{new Date(payment.created_at).toLocaleString('uk-UA')}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{payment.amount} грн</td>
                    <td className="px-6 py-4 text-slate-500 uppercase text-xs">{payment.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}