import { useState, useEffect } from 'react';
import api from '../api';
import CreateObjectModal from './CreateObjectModal';
import ObjectDetailsModal from './ObjectDetailsModal';

interface SecurityObject {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  client_id: number;
  client_email: string;
  instructions: string | null;
  status: string;        // НОВЕ ПОЛЕ
  monthly_fee: number;   // НОВЕ ПОЛЕ
  paid_until: string | null; // НОВЕ ПОЛЕ
}

export default function SecurityObjects() {
  const [objects, setObjects] = useState<SecurityObject[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); 
  const [selectedObject, setSelectedObject] = useState<SecurityObject | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchObjects();
  }, []);

  const fetchObjects = async () => {
    try {
      const response = await api.get('/objects/');
      setObjects(response.data);
    } catch (error) {
      console.error('Помилка завантаження об’єктів:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (obj: SecurityObject) => {
    setSelectedObject(obj);
    setIsDetailsModalOpen(true);
  };

  // Функція для красивого відображення статусу
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Активний</span>;
      case 'SUSPENDED_DEBT': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Борг</span>;
      case 'SUSPENDED_CLIENT': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">Пауза</span>;
      case 'TERMINATED': return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">Відключено</span>;
      default: return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">{status}</span>;
    }
  };

  // Функція для розрахунку статусу оплати
  const getPaymentStatus = (paidUntil: string | null) => {
    if (!paidUntil) return { text: 'Не вказано', color: 'bg-gray-100 text-gray-600' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Обнуляємо години для точного порівняння
    const payDate = new Date(paidUntil);
    
    const diffTime = payDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Борг (${Math.abs(diffDays)} дн.)`, color: 'bg-red-100 text-red-800 border-red-200 shadow-sm' };
    } else if (diffDays <= 5) {
      return { text: `Залишилось ${diffDays} дн.`, color: 'bg-orange-100 text-orange-800 border-orange-200' };
    } else {
      return { text: 'Оплачено', color: 'bg-green-100 text-green-800 border-green-200' };
    }
  };


  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Об'єкти охорони</h1>
          <p className="text-sm text-gray-500 mt-1">Реєстр охоронюваних об'єктів та їх білінг</p>
        </div>
        <div className="space-x-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition shadow-sm font-medium"
          >
            + Додати об'єкт
          </button>
          <button onClick={fetchObjects} className="bg-white text-gray-700 px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 transition shadow-sm font-medium">
            ↻ Оновити
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Завантаження об'єктів...</div>
        ) : objects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Немає зареєстрованих об'єктів.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Об'єкт</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Власник</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Абонплата</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Статус</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {objects.map((obj) => (
                <tr 
                  key={obj.id} 
                  onClick={() => handleRowClick(obj)}
                  className="hover:bg-blue-50 transition cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 block">{obj.name}</span>
                    <span className="text-gray-500 text-xs">{obj.address}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md font-medium border border-purple-100">
                      {obj.client_email}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-700">{obj.monthly_fee} ₴ / міс</div>
                    
                    {/* НОВИЙ РЯДОК: Точна дата */}
                    <div className="mt-1 text-xs text-gray-500 font-medium">
                      {obj.paid_until ? `до ${new Date(obj.paid_until).toLocaleDateString('uk-UA')}` : 'Немає оплат'}
                    </div>

                    {/* ІНДИКАТОР ОПЛАТИ (Бейджик) */}
                    <div className="mt-1.5">
                      {(() => {
                        const payStatus = getPaymentStatus(obj.paid_until);
                        return (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${payStatus.color}`}>
                            {payStatus.text}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(obj.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateObjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={fetchObjects} />
      <ObjectDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} onSuccess={fetchObjects} object={selectedObject} />
    </div>
  );
}